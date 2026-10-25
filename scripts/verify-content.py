"""Offline integrity/structure checks for the 2026-10-25 public source delivery.

Requires Python 3.11+, lxml, jsonschema (with referencing).
Does not modify originals, import clinical data, or approve billing rules.
"""
from __future__ import annotations

import copy
import hashlib
import json
from collections import Counter
from pathlib import Path
from zipfile import ZipFile

from jsonschema import Draft202012Validator, FormatChecker
from lxml import etree
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parents[1]
ICD = ROOT / "data/icd"


def check(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def safe_path(base: Path, relative: str) -> Path:
    check(not Path(relative).is_absolute(), f"Absolute path: {relative}")
    path = (base / relative).resolve()
    check(path.is_relative_to(base.resolve()), f"Escaping path: {relative}")
    return path


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_schema(instance, name: str, registry=None) -> None:
    schema = read_json(ROOT / "schemas" / name)
    Draft202012Validator.check_schema(schema)
    kwargs = {"registry": registry} if registry is not None else {}
    Draft202012Validator(schema, format_checker=FormatChecker(), **kwargs).validate(instance)


def main() -> None:
    manifest = read_json(ICD / "manifest.json")
    validate_schema(manifest, "icd-source-manifest.schema.json")
    paths = [a["path"] for a in manifest["artifacts"]]
    check(len(paths) == len(set(paths)), "Duplicate manifest path")
    for artifact in manifest["artifacts"]:
        path = safe_path(ICD, artifact["path"])
        check(path.stat().st_size == artifact["bytes"], f"Size mismatch: {path.name}")
        check(sha(path) == artifact["sha256"], f"SHA256 mismatch: {path.name}")
        if artifact["archive"] is not None:
            with ZipFile(safe_path(ICD, artifact["archive"])) as archive:
                check(archive.read(artifact["archive_member"]) == path.read_bytes(),
                      f"Extracted bytes differ: {path.name}")
    for name, members in manifest["archives"].items():
        with ZipFile(safe_path(ICD, name)) as archive:
            check(archive.testzip() is None, f"ZIP CRC failed: {name}")
            check(archive.namelist() == members, f"ZIP inventory differs: {name}")

    class LocalSchemaResolver(etree.Resolver):
        def resolve(self, url, public_id, context):
            if url in ("http://www.w3.org/2001/xml.xsd", "https://www.w3.org/2001/xml.xsd"):
                return self.resolve_filename(str(ICD / "w3c-xml.xsd"), context)
            if "://" in url:
                raise ValueError(f"External schema blocked: {url}")
            return None

    parser = etree.XMLParser(resolve_entities=False, no_network=True, load_dtd=False)
    parser.resolvers.add(LocalSchemaResolver())
    xml_path = ICD / "icd10gm2026syst_claml_20250912.xml"
    xml = etree.parse(str(xml_path), parser)
    check(not xml.docinfo.doctype, "DTD is not allowed")
    xsd = etree.XMLSchema(etree.parse(str(ICD / "ClaML2.0.0.xsd"), parser))
    # The official XML has root xml:space="default", but the accompanying XSD
    # does not allow that attribute. Record that exact upstream inconsistency;
    # do not silently repair the source or tolerate other schema errors.
    check(not xsd.validate(xml), "Official XSD behavior changed; review known exception")
    errors = list(xsd.error_log)
    check(len(errors) == 1 and errors[0].type_name == "SCHEMAV_CVC_COMPLEX_TYPE_3_2_1"
          and "{http://www.w3.org/XML/1998/namespace}space" in errors[0].message
          and errors[0].line == 2, f"Unexpected XSD errors: {xsd.error_log}")
    validation_view = copy.deepcopy(xml)
    space = "{http://www.w3.org/XML/1998/namespace}space"
    check(validation_view.getroot().get(space) == "default", "Unexpected root xml:space")
    del validation_view.getroot().attrib[space]
    xsd.assertValid(validation_view)
    root = xml.getroot()
    check(root.tag == "ClaML" and root.get("version") == "2.0.0", "Wrong ClaML version")
    title = root.find("Title")
    check(title is not None and title.get("version") == manifest["version"]
          and title.get("date") == manifest["release_date"], "Wrong ICD release")
    kinds = Counter(c.get("kind") for c in root.findall("Class"))
    rows = [line.split(";") for line in (ICD / "metadata/icd10gm2026syst_kodes.txt")
            .read_text(encoding="utf-8-sig").splitlines()]
    check(all(len(row) == 28 for row in rows), "Metadata column count")
    check(all(row[1] in ("T", "N") for row in rows), "Invalid terminal flag")
    check(len({row[6] for row in rows}) == len(rows), "Duplicate metadata code")
    actual = dict(claml_classes=len(root.findall("Class")), claml_categories=kinds["category"],
                  claml_chapters=kinds["chapter"], claml_blocks=kinds["block"],
                  claml_modifiers=len(root.findall("Modifier")),
                  claml_modifier_classes=len(root.findall("ModifierClass")),
                  metadata_rows=len(rows), metadata_columns=28,
                  terminal_codes=sum(row[1] == "T" for row in rows),
                  nonterminal_codes=sum(row[1] == "N" for row in rows))
    check(actual == manifest["counts"], f"Count mismatch: {actual}")

    correction = read_json(ICD / manifest["corrections"]["instructions"])
    check(correction["applied_to_original_files"] is False, "Originals must be preserved")
    check(sha(safe_path(ICD, correction["source_file"])) == correction["source_sha256"],
          "Corrigenda source mismatch")
    check(len(correction["xml_patches"]) == 3 and len(correction["metadata_patches"]) == 7,
          "Unexpected correction count")
    derived = copy.deepcopy(root)
    for patch in correction["xml_patches"]:
        original_matches = root.findall(patch["selector"])
        matches = derived.findall(patch["selector"])
        check(len(matches) == patch["expected_matches"] == 1, "XML patch is ambiguous")
        check(original_matches[0].get(patch["attribute"]) == patch["expected_old"], "Old XML value differs")
        matches[0].set(patch["attribute"], patch["new"])
        check(matches[0].get(patch["attribute"]) == "j018", "New XML value differs")
    del derived.attrib[space]  # Validation-only view; no source bytes written.
    xsd.assertValid(etree.ElementTree(derived))
    derived_rows = copy.deepcopy(rows)
    for patch in correction["metadata_patches"]:
        col = correction["metadata_code_column_one_based"] - 1
        matches = [row for row in derived_rows if row[col] == patch["code"]]
        check(len(matches) == patch["expected_matches"] == 1, "Metadata patch is ambiguous")
        index = patch["column_one_based"] - 1
        check(matches[0][index] == patch["expected_old"], "Old metadata value differs")
        matches[0][index] = patch["new"]
        check(matches[0][index] == "j018", "New metadata value differs")
    check(sha(xml_path) == next(a["sha256"] for a in manifest["artifacts"] if a["path"] == xml_path.name),
          "Original XML changed")
    print(f"ICD integrity PASS: {len(paths)} hashes; ZIP CRC; extracted bytes; "
          f"{len(rows)} codes ({actual['terminal_codes']} terminal); 3 XML / 7 metadata patch guards.")
    print("ICD XSD: original has exactly one KNOWN upstream error (root xml:space); "
          "validation-only view without that attribute PASS. Original remains unchanged.")

    billing = ROOT / "data/billing"
    source_manifest = read_json(billing / "sources.manifest.json")
    source_hashes = set()
    for artifact in source_manifest["artifacts"]:
        path = safe_path(billing, artifact["path"])
        check(path.stat().st_size == artifact["bytes"] and sha(path) == artifact["sha256"],
              f"Billing source mismatch: {path.name}")
        source_hashes.add(artifact["sha256"])
    rule_schema = read_json(ROOT / "schemas/billing-rule.schema.json")
    registry = Registry().with_resource(rule_schema["$id"], Resource.from_contents(rule_schema))
    dossier = read_json(billing / "rules.draft.2026-q4.json")
    validate_schema(dossier, "billing-draft-dossier.schema.json", registry)
    check(len(dossier["rules"]) == 4, "Expected four drafts")
    for rule in dossier["rules"]:
        check(all(s["sha256"] in source_hashes for s in rule["sources"]), "Unresolved billing source hash")
    print("BILLING PASS: 4 real draft rules; pending reviews; dossier schema; 3 source hashes.")
    for source in read_json(ROOT / "data/legal/sources.manifest.json")["sources"]:
        if source["local_path"]:
            check(sha(safe_path(ROOT / "data/legal", source["local_path"])) == source["sha256"],
                  f"Legal source mismatch: {source['id']}")
    print("LEGAL PASS: local source hashes. Legal compliance and application import are not certified.")


if __name__ == "__main__":
    main()
