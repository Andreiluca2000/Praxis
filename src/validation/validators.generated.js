// @ts-nocheck
/* eslint-disable */
// ERZEUGT von scripts/build-validators.ts – nicht von Hand ändern. Neu erzeugen: pnpm build:validators
import { fullFormats as __formats } from 'ajv-formats/dist/formats.js';
import * as __m0 from 'ajv/dist/runtime/ucs2length.js';
import * as __m1 from 'ajv/dist/runtime/equal.js';
"use strict";
export const rules = validate20;
const schema31 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"urn:praxis-assistent:schema:billing-rule-package:0.1.0","title":"Praxisassistenz billing rule package","description":"Data contract, not an implemented evaluator. Draft and synthetic packages cannot authorize billing.","type":"object","additionalProperties":false,"required":["schema_version","package_id","package_version","content_kind","rules"],"properties":{"schema_version":{"const":"0.1.0"},"package_id":{"type":"string","minLength":1},"package_version":{"type":"string","minLength":1},"content_kind":{"enum":["synthetic_example","reviewed_catalogue"]},"rules":{"type":"array","minItems":1,"items":{"$ref":"#/$defs/rule"}}},"allOf":[{"if":{"properties":{"content_kind":{"const":"synthetic_example"}}},"then":{"properties":{"rules":{"items":{"properties":{"id":{"pattern":"^DEMO_"},"billing_system":{"const":"DEMO"},"status":{"const":"draft"},"procedure_codes":{"items":{"pattern":"^DEMO_"}},"sources":{"items":{"properties":{"kind":{"const":"synthetic"}}}}}}}}}}],"$defs":{"date":{"type":"string","format":"date"},"codes":{"type":"array","items":{"type":"string","minLength":1},"uniqueItems":true},"source_ids":{"type":"array","minItems":1,"items":{"type":"string","minLength":1},"uniqueItems":true},"window":{"type":"object","additionalProperties":false,"required":["unit","lookback_periods","anchor"],"properties":{"unit":{"enum":["visit","day","treatment_case","quarter","year"]},"lookback_periods":{"type":"integer","minimum":0},"anchor":{"const":"service_date"}}},"source":{"type":"object","additionalProperties":false,"required":["id","kind","publisher","title","uri","version","locator","checked_on","license_status"],"properties":{"id":{"type":"string","minLength":1},"kind":{"enum":["legal_text","official_catalogue","contract","official_guidance","synthetic"]},"publisher":{"type":"string","minLength":1},"title":{"type":"string","minLength":1},"uri":{"type":"string","format":"uri"},"version":{"type":"string","minLength":1},"locator":{"type":"string","minLength":1},"checked_on":{"$ref":"#/$defs/date"},"sha256":{"type":["string","null"],"pattern":"^[a-f0-9]{64}$"},"license_status":{"enum":["pending","permitted_for_local_use","permitted_for_distribution","synthetic_owned"]}}},"review":{"type":"object","additionalProperties":false,"required":["state","reviewer","reviewed_at","rationale"],"properties":{"state":{"enum":["pending","approved","rejected","not_applicable"]},"reviewer":{"type":["string","null"]},"reviewed_at":{"type":["string","null"],"format":"date-time"},"rationale":{"type":["string","null"]}},"allOf":[{"if":{"properties":{"state":{"enum":["approved","not_applicable"]}}},"then":{"properties":{"reviewer":{"type":"string","minLength":1},"reviewed_at":{"type":"string","format":"date-time"},"rationale":{"type":"string","minLength":1}}}}]},"expression":{"oneOf":[{"type":"object","additionalProperties":false,"required":["kind","field","operator","source_ids"],"properties":{"kind":{"const":"fact"},"field":{"enum":["service.status","service.date","service.mode","service.performer","service.age_years_at_date","documentation.duration_minutes","documentation.required_components_complete","practice.required_authorization","practice.required_qualification","contract.practice_participation","contract.patient_enrollment","contract.covers_service_date","contract.service_included","evidence.complete","billed_services.count","diagnosis.chronic_confirmed","diagnosis.dm2_confirmed","history.chronic_contact_quarters","history.personal_contact_quarters","history.base_03100_two_quarters_before","documentation.intensive_care_confirmed","dmp.practice_participation","dmp.patient_enrolled","dmp.documentation_transmitted"]},"operator":{"enum":["eq","neq","in","gte","lte","is_known"]},"value":{"oneOf":[{"type":["string","number","boolean"]},{"type":"array","minItems":1,"uniqueItems":true,"items":{"type":["string","number","boolean"]}}]},"source_ids":{"$ref":"#/$defs/source_ids"}},"allOf":[{"if":{"properties":{"operator":{"const":"is_known"}}},"then":{"not":{"required":["value"]}},"else":{"required":["value"]}},{"if":{"properties":{"operator":{"enum":["gte","lte"]}}},"then":{"properties":{"value":{"type":"number"}}}},{"if":{"properties":{"operator":{"const":"in"}}},"then":{"properties":{"value":{"type":"array"}}}},{"if":{"properties":{"operator":{"enum":["eq","neq"]}}},"then":{"properties":{"value":{"type":["string","number","boolean"]}}}}]},{"type":"object","additionalProperties":false,"required":["kind","items"],"properties":{"kind":{"enum":["all","any"]},"items":{"type":"array","minItems":1,"items":{"$ref":"#/$defs/expression"}}}},{"type":"object","additionalProperties":false,"required":["kind","item"],"properties":{"kind":{"const":"not"},"item":{"$ref":"#/$defs/expression"}}}]},"rule":{"type":"object","additionalProperties":false,"required":["id","version","billing_system","status","title","procedure_codes","valid_from","valid_to","jurisdiction","contract_id","sources","reviews","required_context","eligibility","combination_rules","frequency_limits","result"],"properties":{"id":{"type":"string","minLength":1},"version":{"type":"string","minLength":1},"billing_system":{"enum":["EBM","GOAE","HZV","KV","DEMO"]},"status":{"enum":["draft","reviewed","active","retired"]},"title":{"type":"string","minLength":1},"procedure_codes":{"allOf":[{"$ref":"#/$defs/codes"},{"minItems":1}]},"valid_from":{"$ref":"#/$defs/date"},"valid_to":{"type":["string","null"],"format":"date"},"jurisdiction":{"enum":["DE","Nordrhein","Westfalen-Lippe","synthetic"]},"contract_id":{"type":["string","null"]},"sources":{"type":"array","minItems":1,"items":{"$ref":"#/$defs/source"}},"reviews":{"type":"object","additionalProperties":false,"required":["billing","clinical"],"properties":{"billing":{"$ref":"#/$defs/review"},"clinical":{"$ref":"#/$defs/review"}}},"required_context":{"type":"array","minItems":1,"items":{"type":"object","additionalProperties":false,"required":["domain","window"],"properties":{"domain":{"enum":["documentation","billed_services","practice_authorizations","contract_terms","practice_participation","patient_enrollment"]},"window":{"$ref":"#/$defs/window"}}}},"eligibility":{"$ref":"#/$defs/expression"},"combination_rules":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["relationship","with_codes","window","reason","source_ids"],"properties":{"relationship":{"enum":["cannot_combine","included_in","requires_code","excluded_by"]},"with_codes":{"allOf":[{"$ref":"#/$defs/codes"},{"minItems":1}]},"window":{"$ref":"#/$defs/window"},"reason":{"type":"string","minLength":1},"source_ids":{"$ref":"#/$defs/source_ids"}}}},"frequency_limits":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["max_count","count_codes","window","source_ids"],"properties":{"max_count":{"type":"integer","minimum":1},"count_codes":{"allOf":[{"$ref":"#/$defs/codes"},{"minItems":1}]},"window":{"$ref":"#/$defs/window"},"source_ids":{"$ref":"#/$defs/source_ids"}}}},"result":{"type":"object","additionalProperties":false,"required":["type","explanation","missing_evidence_message","requires_human_confirmation"],"properties":{"type":{"enum":["possible_missing_code","documentation_incomplete","coding_missing","billing_conflict"]},"explanation":{"type":"string","minLength":1},"missing_evidence_message":{"type":"string","minLength":1},"requires_human_confirmation":{"const":true}}}},"allOf":[{"if":{"properties":{"billing_system":{"const":"HZV"}}},"then":{"properties":{"contract_id":{"type":"string","minLength":1}}}},{"if":{"properties":{"billing_system":{"const":"KV"}}},"then":{"properties":{"jurisdiction":{"enum":["Nordrhein","Westfalen-Lippe"]}}}},{"if":{"properties":{"billing_system":{"const":"DEMO"}}},"then":{"properties":{"status":{"const":"draft"},"id":{"pattern":"^DEMO_"},"procedure_codes":{"items":{"pattern":"^DEMO_"}}}}},{"if":{"properties":{"status":{"const":"active"}}},"then":{"properties":{"billing_system":{"enum":["EBM","GOAE","HZV","KV"]},"jurisdiction":{"enum":["DE","Nordrhein","Westfalen-Lippe"]},"reviews":{"properties":{"billing":{"properties":{"state":{"const":"approved"}}},"clinical":{"properties":{"state":{"enum":["approved","not_applicable"]}}}}},"sources":{"items":{"properties":{"kind":{"enum":["legal_text","official_catalogue","contract","official_guidance"]},"license_status":{"enum":["permitted_for_local_use","permitted_for_distribution"]}}}}}}}]}}};
const pattern4 = new RegExp("^DEMO_", "u");
const func1 = typeof __m0.default === 'function' ? __m0.default : __m0.default.default;
const schema32 = {"type":"object","additionalProperties":false,"required":["id","version","billing_system","status","title","procedure_codes","valid_from","valid_to","jurisdiction","contract_id","sources","reviews","required_context","eligibility","combination_rules","frequency_limits","result"],"properties":{"id":{"type":"string","minLength":1},"version":{"type":"string","minLength":1},"billing_system":{"enum":["EBM","GOAE","HZV","KV","DEMO"]},"status":{"enum":["draft","reviewed","active","retired"]},"title":{"type":"string","minLength":1},"procedure_codes":{"allOf":[{"$ref":"#/$defs/codes"},{"minItems":1}]},"valid_from":{"$ref":"#/$defs/date"},"valid_to":{"type":["string","null"],"format":"date"},"jurisdiction":{"enum":["DE","Nordrhein","Westfalen-Lippe","synthetic"]},"contract_id":{"type":["string","null"]},"sources":{"type":"array","minItems":1,"items":{"$ref":"#/$defs/source"}},"reviews":{"type":"object","additionalProperties":false,"required":["billing","clinical"],"properties":{"billing":{"$ref":"#/$defs/review"},"clinical":{"$ref":"#/$defs/review"}}},"required_context":{"type":"array","minItems":1,"items":{"type":"object","additionalProperties":false,"required":["domain","window"],"properties":{"domain":{"enum":["documentation","billed_services","practice_authorizations","contract_terms","practice_participation","patient_enrollment"]},"window":{"$ref":"#/$defs/window"}}}},"eligibility":{"$ref":"#/$defs/expression"},"combination_rules":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["relationship","with_codes","window","reason","source_ids"],"properties":{"relationship":{"enum":["cannot_combine","included_in","requires_code","excluded_by"]},"with_codes":{"allOf":[{"$ref":"#/$defs/codes"},{"minItems":1}]},"window":{"$ref":"#/$defs/window"},"reason":{"type":"string","minLength":1},"source_ids":{"$ref":"#/$defs/source_ids"}}}},"frequency_limits":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["max_count","count_codes","window","source_ids"],"properties":{"max_count":{"type":"integer","minimum":1},"count_codes":{"allOf":[{"$ref":"#/$defs/codes"},{"minItems":1}]},"window":{"$ref":"#/$defs/window"},"source_ids":{"$ref":"#/$defs/source_ids"}}}},"result":{"type":"object","additionalProperties":false,"required":["type","explanation","missing_evidence_message","requires_human_confirmation"],"properties":{"type":{"enum":["possible_missing_code","documentation_incomplete","coding_missing","billing_conflict"]},"explanation":{"type":"string","minLength":1},"missing_evidence_message":{"type":"string","minLength":1},"requires_human_confirmation":{"const":true}}}},"allOf":[{"if":{"properties":{"billing_system":{"const":"HZV"}}},"then":{"properties":{"contract_id":{"type":"string","minLength":1}}}},{"if":{"properties":{"billing_system":{"const":"KV"}}},"then":{"properties":{"jurisdiction":{"enum":["Nordrhein","Westfalen-Lippe"]}}}},{"if":{"properties":{"billing_system":{"const":"DEMO"}}},"then":{"properties":{"status":{"const":"draft"},"id":{"pattern":"^DEMO_"},"procedure_codes":{"items":{"pattern":"^DEMO_"}}}}},{"if":{"properties":{"status":{"const":"active"}}},"then":{"properties":{"billing_system":{"enum":["EBM","GOAE","HZV","KV"]},"jurisdiction":{"enum":["DE","Nordrhein","Westfalen-Lippe"]},"reviews":{"properties":{"billing":{"properties":{"state":{"const":"approved"}}},"clinical":{"properties":{"state":{"enum":["approved","not_applicable"]}}}}},"sources":{"items":{"properties":{"kind":{"enum":["legal_text","official_catalogue","contract","official_guidance"]},"license_status":{"enum":["permitted_for_local_use","permitted_for_distribution"]}}}}}}}]};
const schema33 = {"type":"array","items":{"type":"string","minLength":1},"uniqueItems":true};
const schema34 = {"type":"string","format":"date"};
const schema37 = {"type":"object","additionalProperties":false,"required":["state","reviewer","reviewed_at","rationale"],"properties":{"state":{"enum":["pending","approved","rejected","not_applicable"]},"reviewer":{"type":["string","null"]},"reviewed_at":{"type":["string","null"],"format":"date-time"},"rationale":{"type":["string","null"]}},"allOf":[{"if":{"properties":{"state":{"enum":["approved","not_applicable"]}}},"then":{"properties":{"reviewer":{"type":"string","minLength":1},"reviewed_at":{"type":"string","format":"date-time"},"rationale":{"type":"string","minLength":1}}}}]};
const schema39 = {"type":"object","additionalProperties":false,"required":["unit","lookback_periods","anchor"],"properties":{"unit":{"enum":["visit","day","treatment_case","quarter","year"]},"lookback_periods":{"type":"integer","minimum":0},"anchor":{"const":"service_date"}}};
const schema41 = {"type":"array","minItems":1,"items":{"type":"string","minLength":1},"uniqueItems":true};
const func4 = Object.prototype.hasOwnProperty;
const formats0 = __formats.date;
const formats8 = __formats["date-time"];
const schema35 = {"type":"object","additionalProperties":false,"required":["id","kind","publisher","title","uri","version","locator","checked_on","license_status"],"properties":{"id":{"type":"string","minLength":1},"kind":{"enum":["legal_text","official_catalogue","contract","official_guidance","synthetic"]},"publisher":{"type":"string","minLength":1},"title":{"type":"string","minLength":1},"uri":{"type":"string","format":"uri"},"version":{"type":"string","minLength":1},"locator":{"type":"string","minLength":1},"checked_on":{"$ref":"#/$defs/date"},"sha256":{"type":["string","null"],"pattern":"^[a-f0-9]{64}$"},"license_status":{"enum":["pending","permitted_for_local_use","permitted_for_distribution","synthetic_owned"]}}};
const formats4 = __formats.uri;
const pattern8 = new RegExp("^[a-f0-9]{64}$", "u");

function validate22(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
let vErrors = null;
let errors = 0;
const evaluated0 = validate22.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.id === undefined){
const err0 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err0];
}
else {
vErrors.push(err0);
}
errors++;
}
if(data.kind === undefined){
const err1 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "kind"},message:"must have required property '"+"kind"+"'"};
if(vErrors === null){
vErrors = [err1];
}
else {
vErrors.push(err1);
}
errors++;
}
if(data.publisher === undefined){
const err2 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "publisher"},message:"must have required property '"+"publisher"+"'"};
if(vErrors === null){
vErrors = [err2];
}
else {
vErrors.push(err2);
}
errors++;
}
if(data.title === undefined){
const err3 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "title"},message:"must have required property '"+"title"+"'"};
if(vErrors === null){
vErrors = [err3];
}
else {
vErrors.push(err3);
}
errors++;
}
if(data.uri === undefined){
const err4 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "uri"},message:"must have required property '"+"uri"+"'"};
if(vErrors === null){
vErrors = [err4];
}
else {
vErrors.push(err4);
}
errors++;
}
if(data.version === undefined){
const err5 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "version"},message:"must have required property '"+"version"+"'"};
if(vErrors === null){
vErrors = [err5];
}
else {
vErrors.push(err5);
}
errors++;
}
if(data.locator === undefined){
const err6 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "locator"},message:"must have required property '"+"locator"+"'"};
if(vErrors === null){
vErrors = [err6];
}
else {
vErrors.push(err6);
}
errors++;
}
if(data.checked_on === undefined){
const err7 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "checked_on"},message:"must have required property '"+"checked_on"+"'"};
if(vErrors === null){
vErrors = [err7];
}
else {
vErrors.push(err7);
}
errors++;
}
if(data.license_status === undefined){
const err8 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "license_status"},message:"must have required property '"+"license_status"+"'"};
if(vErrors === null){
vErrors = [err8];
}
else {
vErrors.push(err8);
}
errors++;
}
for(const key0 in data){
if(!(func4.call(schema35.properties, key0))){
const err9 = {instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err9];
}
else {
vErrors.push(err9);
}
errors++;
}
}
if(data.id !== undefined){
let data0 = data.id;
if(typeof data0 === "string"){
if(func1(data0) < 1){
const err10 = {instancePath:instancePath+"/id",schemaPath:"#/properties/id/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err10];
}
else {
vErrors.push(err10);
}
errors++;
}
}
else {
const err11 = {instancePath:instancePath+"/id",schemaPath:"#/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err11];
}
else {
vErrors.push(err11);
}
errors++;
}
}
if(data.kind !== undefined){
let data1 = data.kind;
if(!(((((data1 === "legal_text") || (data1 === "official_catalogue")) || (data1 === "contract")) || (data1 === "official_guidance")) || (data1 === "synthetic"))){
const err12 = {instancePath:instancePath+"/kind",schemaPath:"#/properties/kind/enum",keyword:"enum",params:{allowedValues: schema35.properties.kind.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err12];
}
else {
vErrors.push(err12);
}
errors++;
}
}
if(data.publisher !== undefined){
let data2 = data.publisher;
if(typeof data2 === "string"){
if(func1(data2) < 1){
const err13 = {instancePath:instancePath+"/publisher",schemaPath:"#/properties/publisher/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err13];
}
else {
vErrors.push(err13);
}
errors++;
}
}
else {
const err14 = {instancePath:instancePath+"/publisher",schemaPath:"#/properties/publisher/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err14];
}
else {
vErrors.push(err14);
}
errors++;
}
}
if(data.title !== undefined){
let data3 = data.title;
if(typeof data3 === "string"){
if(func1(data3) < 1){
const err15 = {instancePath:instancePath+"/title",schemaPath:"#/properties/title/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err15];
}
else {
vErrors.push(err15);
}
errors++;
}
}
else {
const err16 = {instancePath:instancePath+"/title",schemaPath:"#/properties/title/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err16];
}
else {
vErrors.push(err16);
}
errors++;
}
}
if(data.uri !== undefined){
let data4 = data.uri;
if(typeof data4 === "string"){
if(!(formats4(data4))){
const err17 = {instancePath:instancePath+"/uri",schemaPath:"#/properties/uri/format",keyword:"format",params:{format: "uri"},message:"must match format \""+"uri"+"\""};
if(vErrors === null){
vErrors = [err17];
}
else {
vErrors.push(err17);
}
errors++;
}
}
else {
const err18 = {instancePath:instancePath+"/uri",schemaPath:"#/properties/uri/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err18];
}
else {
vErrors.push(err18);
}
errors++;
}
}
if(data.version !== undefined){
let data5 = data.version;
if(typeof data5 === "string"){
if(func1(data5) < 1){
const err19 = {instancePath:instancePath+"/version",schemaPath:"#/properties/version/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err19];
}
else {
vErrors.push(err19);
}
errors++;
}
}
else {
const err20 = {instancePath:instancePath+"/version",schemaPath:"#/properties/version/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err20];
}
else {
vErrors.push(err20);
}
errors++;
}
}
if(data.locator !== undefined){
let data6 = data.locator;
if(typeof data6 === "string"){
if(func1(data6) < 1){
const err21 = {instancePath:instancePath+"/locator",schemaPath:"#/properties/locator/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err21];
}
else {
vErrors.push(err21);
}
errors++;
}
}
else {
const err22 = {instancePath:instancePath+"/locator",schemaPath:"#/properties/locator/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err22];
}
else {
vErrors.push(err22);
}
errors++;
}
}
if(data.checked_on !== undefined){
let data7 = data.checked_on;
if(typeof data7 === "string"){
if(!(formats0.validate(data7))){
const err23 = {instancePath:instancePath+"/checked_on",schemaPath:"#/$defs/date/format",keyword:"format",params:{format: "date"},message:"must match format \""+"date"+"\""};
if(vErrors === null){
vErrors = [err23];
}
else {
vErrors.push(err23);
}
errors++;
}
}
else {
const err24 = {instancePath:instancePath+"/checked_on",schemaPath:"#/$defs/date/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err24];
}
else {
vErrors.push(err24);
}
errors++;
}
}
if(data.sha256 !== undefined){
let data8 = data.sha256;
if((typeof data8 !== "string") && (data8 !== null)){
const err25 = {instancePath:instancePath+"/sha256",schemaPath:"#/properties/sha256/type",keyword:"type",params:{type: schema35.properties.sha256.type},message:"must be string,null"};
if(vErrors === null){
vErrors = [err25];
}
else {
vErrors.push(err25);
}
errors++;
}
if(typeof data8 === "string"){
if(!pattern8.test(data8)){
const err26 = {instancePath:instancePath+"/sha256",schemaPath:"#/properties/sha256/pattern",keyword:"pattern",params:{pattern: "^[a-f0-9]{64}$"},message:"must match pattern \""+"^[a-f0-9]{64}$"+"\""};
if(vErrors === null){
vErrors = [err26];
}
else {
vErrors.push(err26);
}
errors++;
}
}
}
if(data.license_status !== undefined){
let data9 = data.license_status;
if(!((((data9 === "pending") || (data9 === "permitted_for_local_use")) || (data9 === "permitted_for_distribution")) || (data9 === "synthetic_owned"))){
const err27 = {instancePath:instancePath+"/license_status",schemaPath:"#/properties/license_status/enum",keyword:"enum",params:{allowedValues: schema35.properties.license_status.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err27];
}
else {
vErrors.push(err27);
}
errors++;
}
}
}
else {
const err28 = {instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err28];
}
else {
vErrors.push(err28);
}
errors++;
}
validate22.errors = vErrors;
return errors === 0;
}
validate22.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};

const schema40 = {"oneOf":[{"type":"object","additionalProperties":false,"required":["kind","field","operator","source_ids"],"properties":{"kind":{"const":"fact"},"field":{"enum":["service.status","service.date","service.mode","service.performer","service.age_years_at_date","documentation.duration_minutes","documentation.required_components_complete","practice.required_authorization","practice.required_qualification","contract.practice_participation","contract.patient_enrollment","contract.covers_service_date","contract.service_included","evidence.complete","billed_services.count","diagnosis.chronic_confirmed","diagnosis.dm2_confirmed","history.chronic_contact_quarters","history.personal_contact_quarters","history.base_03100_two_quarters_before","documentation.intensive_care_confirmed","dmp.practice_participation","dmp.patient_enrolled","dmp.documentation_transmitted"]},"operator":{"enum":["eq","neq","in","gte","lte","is_known"]},"value":{"oneOf":[{"type":["string","number","boolean"]},{"type":"array","minItems":1,"uniqueItems":true,"items":{"type":["string","number","boolean"]}}]},"source_ids":{"$ref":"#/$defs/source_ids"}},"allOf":[{"if":{"properties":{"operator":{"const":"is_known"}}},"then":{"not":{"required":["value"]}},"else":{"required":["value"]}},{"if":{"properties":{"operator":{"enum":["gte","lte"]}}},"then":{"properties":{"value":{"type":"number"}}}},{"if":{"properties":{"operator":{"const":"in"}}},"then":{"properties":{"value":{"type":"array"}}}},{"if":{"properties":{"operator":{"enum":["eq","neq"]}}},"then":{"properties":{"value":{"type":["string","number","boolean"]}}}}]},{"type":"object","additionalProperties":false,"required":["kind","items"],"properties":{"kind":{"enum":["all","any"]},"items":{"type":"array","minItems":1,"items":{"$ref":"#/$defs/expression"}}}},{"type":"object","additionalProperties":false,"required":["kind","item"],"properties":{"kind":{"const":"not"},"item":{"$ref":"#/$defs/expression"}}}]};
const wrapper0 = {validate: validate24};

function validate24(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
let vErrors = null;
let errors = 0;
const evaluated0 = validate24.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
const _errs0 = errors;
let valid0 = false;
let passing0 = null;
const _errs1 = errors;
const _errs4 = errors;
let valid2 = true;
const _errs5 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.operator !== undefined){
if("is_known" !== data.operator){
const err0 = {};
if(vErrors === null){
vErrors = [err0];
}
else {
vErrors.push(err0);
}
errors++;
}
}
}
var _valid1 = _errs5 === errors;
errors = _errs4;
if(vErrors !== null){
if(_errs4){
vErrors.length = _errs4;
}
else {
vErrors = null;
}
}
let ifClause0;
if(_valid1){
const _errs7 = errors;
const _errs8 = errors;
const _errs9 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
let missing0;
if((data.value === undefined) && (missing0 = "value")){
const err1 = {};
if(vErrors === null){
vErrors = [err1];
}
else {
vErrors.push(err1);
}
errors++;
}
}
var valid4 = _errs9 === errors;
if(valid4){
const err2 = {instancePath,schemaPath:"#/oneOf/0/allOf/0/then/not",keyword:"not",params:{},message:"must NOT be valid"};
if(vErrors === null){
vErrors = [err2];
}
else {
vErrors.push(err2);
}
errors++;
}
else {
errors = _errs8;
if(vErrors !== null){
if(_errs8){
vErrors.length = _errs8;
}
else {
vErrors = null;
}
}
}
var _valid1 = _errs7 === errors;
valid2 = _valid1;
ifClause0 = "then";
}
else {
const _errs10 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.value === undefined){
const err3 = {instancePath,schemaPath:"#/oneOf/0/allOf/0/else/required",keyword:"required",params:{missingProperty: "value"},message:"must have required property '"+"value"+"'"};
if(vErrors === null){
vErrors = [err3];
}
else {
vErrors.push(err3);
}
errors++;
}
}
var _valid1 = _errs10 === errors;
valid2 = _valid1;
ifClause0 = "else";
}
if(!valid2){
const err4 = {instancePath,schemaPath:"#/oneOf/0/allOf/0/if",keyword:"if",params:{failingKeyword: ifClause0},message:"must match \""+ifClause0+"\" schema"};
if(vErrors === null){
vErrors = [err4];
}
else {
vErrors.push(err4);
}
errors++;
}
const _errs12 = errors;
let valid5 = true;
const _errs13 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.operator !== undefined){
let data1 = data.operator;
if(!((data1 === "gte") || (data1 === "lte"))){
const err5 = {};
if(vErrors === null){
vErrors = [err5];
}
else {
vErrors.push(err5);
}
errors++;
}
}
}
var _valid2 = _errs13 === errors;
errors = _errs12;
if(vErrors !== null){
if(_errs12){
vErrors.length = _errs12;
}
else {
vErrors = null;
}
}
if(_valid2){
const _errs15 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.value !== undefined){
let data2 = data.value;
if(!((typeof data2 == "number") && (isFinite(data2)))){
const err6 = {instancePath:instancePath+"/value",schemaPath:"#/oneOf/0/allOf/1/then/properties/value/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err6];
}
else {
vErrors.push(err6);
}
errors++;
}
}
}
var _valid2 = _errs15 === errors;
valid5 = _valid2;
if(valid5){
var props0 = {};
props0.value = true;
props0.operator = true;
}
}
if(!valid5){
const err7 = {instancePath,schemaPath:"#/oneOf/0/allOf/1/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err7];
}
else {
vErrors.push(err7);
}
errors++;
}
if(props0 !== true){
props0 = props0 || {};
props0.operator = true;
}
const _errs19 = errors;
let valid8 = true;
const _errs20 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.operator !== undefined){
if("in" !== data.operator){
const err8 = {};
if(vErrors === null){
vErrors = [err8];
}
else {
vErrors.push(err8);
}
errors++;
}
}
}
var _valid3 = _errs20 === errors;
errors = _errs19;
if(vErrors !== null){
if(_errs19){
vErrors.length = _errs19;
}
else {
vErrors = null;
}
}
if(_valid3){
const _errs22 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.value !== undefined){
if(!(Array.isArray(data.value))){
const err9 = {instancePath:instancePath+"/value",schemaPath:"#/oneOf/0/allOf/2/then/properties/value/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err9];
}
else {
vErrors.push(err9);
}
errors++;
}
}
}
var _valid3 = _errs22 === errors;
valid8 = _valid3;
if(valid8){
var props1 = {};
props1.value = true;
props1.operator = true;
}
}
if(!valid8){
const err10 = {instancePath,schemaPath:"#/oneOf/0/allOf/2/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err10];
}
else {
vErrors.push(err10);
}
errors++;
}
if(props0 !== true && props1 !== undefined){
if(props1 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props1);
}
}
const _errs26 = errors;
let valid11 = true;
const _errs27 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.operator !== undefined){
let data5 = data.operator;
if(!((data5 === "eq") || (data5 === "neq"))){
const err11 = {};
if(vErrors === null){
vErrors = [err11];
}
else {
vErrors.push(err11);
}
errors++;
}
}
}
var _valid4 = _errs27 === errors;
errors = _errs26;
if(vErrors !== null){
if(_errs26){
vErrors.length = _errs26;
}
else {
vErrors = null;
}
}
if(_valid4){
const _errs29 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.value !== undefined){
let data6 = data.value;
if(((typeof data6 !== "string") && (!((typeof data6 == "number") && (isFinite(data6))))) && (typeof data6 !== "boolean")){
const err12 = {instancePath:instancePath+"/value",schemaPath:"#/oneOf/0/allOf/3/then/properties/value/type",keyword:"type",params:{type: schema40.oneOf[0].allOf[3].then.properties.value.type},message:"must be string,number,boolean"};
if(vErrors === null){
vErrors = [err12];
}
else {
vErrors.push(err12);
}
errors++;
}
}
}
var _valid4 = _errs29 === errors;
valid11 = _valid4;
if(valid11){
var props2 = {};
props2.value = true;
props2.operator = true;
}
}
if(!valid11){
const err13 = {instancePath,schemaPath:"#/oneOf/0/allOf/3/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err13];
}
else {
vErrors.push(err13);
}
errors++;
}
if(props0 !== true && props2 !== undefined){
if(props2 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props2);
}
}
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.kind === undefined){
const err14 = {instancePath,schemaPath:"#/oneOf/0/required",keyword:"required",params:{missingProperty: "kind"},message:"must have required property '"+"kind"+"'"};
if(vErrors === null){
vErrors = [err14];
}
else {
vErrors.push(err14);
}
errors++;
}
if(data.field === undefined){
const err15 = {instancePath,schemaPath:"#/oneOf/0/required",keyword:"required",params:{missingProperty: "field"},message:"must have required property '"+"field"+"'"};
if(vErrors === null){
vErrors = [err15];
}
else {
vErrors.push(err15);
}
errors++;
}
if(data.operator === undefined){
const err16 = {instancePath,schemaPath:"#/oneOf/0/required",keyword:"required",params:{missingProperty: "operator"},message:"must have required property '"+"operator"+"'"};
if(vErrors === null){
vErrors = [err16];
}
else {
vErrors.push(err16);
}
errors++;
}
if(data.source_ids === undefined){
const err17 = {instancePath,schemaPath:"#/oneOf/0/required",keyword:"required",params:{missingProperty: "source_ids"},message:"must have required property '"+"source_ids"+"'"};
if(vErrors === null){
vErrors = [err17];
}
else {
vErrors.push(err17);
}
errors++;
}
for(const key0 in data){
if(!(((((key0 === "kind") || (key0 === "field")) || (key0 === "operator")) || (key0 === "value")) || (key0 === "source_ids"))){
const err18 = {instancePath,schemaPath:"#/oneOf/0/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err18];
}
else {
vErrors.push(err18);
}
errors++;
}
}
if(data.kind !== undefined){
if("fact" !== data.kind){
const err19 = {instancePath:instancePath+"/kind",schemaPath:"#/oneOf/0/properties/kind/const",keyword:"const",params:{allowedValue: "fact"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err19];
}
else {
vErrors.push(err19);
}
errors++;
}
}
if(data.field !== undefined){
let data8 = data.field;
if(!((((((((((((((((((((((((data8 === "service.status") || (data8 === "service.date")) || (data8 === "service.mode")) || (data8 === "service.performer")) || (data8 === "service.age_years_at_date")) || (data8 === "documentation.duration_minutes")) || (data8 === "documentation.required_components_complete")) || (data8 === "practice.required_authorization")) || (data8 === "practice.required_qualification")) || (data8 === "contract.practice_participation")) || (data8 === "contract.patient_enrollment")) || (data8 === "contract.covers_service_date")) || (data8 === "contract.service_included")) || (data8 === "evidence.complete")) || (data8 === "billed_services.count")) || (data8 === "diagnosis.chronic_confirmed")) || (data8 === "diagnosis.dm2_confirmed")) || (data8 === "history.chronic_contact_quarters")) || (data8 === "history.personal_contact_quarters")) || (data8 === "history.base_03100_two_quarters_before")) || (data8 === "documentation.intensive_care_confirmed")) || (data8 === "dmp.practice_participation")) || (data8 === "dmp.patient_enrolled")) || (data8 === "dmp.documentation_transmitted"))){
const err20 = {instancePath:instancePath+"/field",schemaPath:"#/oneOf/0/properties/field/enum",keyword:"enum",params:{allowedValues: schema40.oneOf[0].properties.field.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err20];
}
else {
vErrors.push(err20);
}
errors++;
}
}
if(data.operator !== undefined){
let data9 = data.operator;
if(!((((((data9 === "eq") || (data9 === "neq")) || (data9 === "in")) || (data9 === "gte")) || (data9 === "lte")) || (data9 === "is_known"))){
const err21 = {instancePath:instancePath+"/operator",schemaPath:"#/oneOf/0/properties/operator/enum",keyword:"enum",params:{allowedValues: schema40.oneOf[0].properties.operator.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err21];
}
else {
vErrors.push(err21);
}
errors++;
}
}
if(data.value !== undefined){
let data10 = data.value;
const _errs37 = errors;
let valid15 = false;
let passing1 = null;
const _errs38 = errors;
if(((typeof data10 !== "string") && (!((typeof data10 == "number") && (isFinite(data10))))) && (typeof data10 !== "boolean")){
const err22 = {instancePath:instancePath+"/value",schemaPath:"#/oneOf/0/properties/value/oneOf/0/type",keyword:"type",params:{type: schema40.oneOf[0].properties.value.oneOf[0].type},message:"must be string,number,boolean"};
if(vErrors === null){
vErrors = [err22];
}
else {
vErrors.push(err22);
}
errors++;
}
var _valid5 = _errs38 === errors;
if(_valid5){
valid15 = true;
passing1 = 0;
}
const _errs40 = errors;
if(Array.isArray(data10)){
if(data10.length < 1){
const err23 = {instancePath:instancePath+"/value",schemaPath:"#/oneOf/0/properties/value/oneOf/1/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"};
if(vErrors === null){
vErrors = [err23];
}
else {
vErrors.push(err23);
}
errors++;
}
const len0 = data10.length;
for(let i0=0; i0<len0; i0++){
let data11 = data10[i0];
if(((typeof data11 !== "string") && (!((typeof data11 == "number") && (isFinite(data11))))) && (typeof data11 !== "boolean")){
const err24 = {instancePath:instancePath+"/value/" + i0,schemaPath:"#/oneOf/0/properties/value/oneOf/1/items/type",keyword:"type",params:{type: schema40.oneOf[0].properties.value.oneOf[1].items.type},message:"must be string,number,boolean"};
if(vErrors === null){
vErrors = [err24];
}
else {
vErrors.push(err24);
}
errors++;
}
}
let i1 = data10.length;
let j0;
if(i1 > 1){
const indices0 = {};
for(;i1--;){
let item0 = data10[i1];
if(((typeof item0 !== "string") && (!((typeof item0 == "number") && (isFinite(item0))))) && (typeof item0 !== "boolean")){
continue;
}
if(typeof item0 == "string"){
item0 += "_";
}
if(typeof indices0[item0] == "number"){
j0 = indices0[item0];
const err25 = {instancePath:instancePath+"/value",schemaPath:"#/oneOf/0/properties/value/oneOf/1/uniqueItems",keyword:"uniqueItems",params:{i: i1, j: j0},message:"must NOT have duplicate items (items ## "+j0+" and "+i1+" are identical)"};
if(vErrors === null){
vErrors = [err25];
}
else {
vErrors.push(err25);
}
errors++;
break;
}
indices0[item0] = i1;
}
}
}
else {
const err26 = {instancePath:instancePath+"/value",schemaPath:"#/oneOf/0/properties/value/oneOf/1/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err26];
}
else {
vErrors.push(err26);
}
errors++;
}
var _valid5 = _errs40 === errors;
if(_valid5 && valid15){
valid15 = false;
passing1 = [passing1, 1];
}
else {
if(_valid5){
valid15 = true;
passing1 = 1;
}
}
if(!valid15){
const err27 = {instancePath:instancePath+"/value",schemaPath:"#/oneOf/0/properties/value/oneOf",keyword:"oneOf",params:{passingSchemas: passing1},message:"must match exactly one schema in oneOf"};
if(vErrors === null){
vErrors = [err27];
}
else {
vErrors.push(err27);
}
errors++;
}
else {
errors = _errs37;
if(vErrors !== null){
if(_errs37){
vErrors.length = _errs37;
}
else {
vErrors = null;
}
}
}
}
if(data.source_ids !== undefined){
let data12 = data.source_ids;
if(Array.isArray(data12)){
if(data12.length < 1){
const err28 = {instancePath:instancePath+"/source_ids",schemaPath:"#/$defs/source_ids/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"};
if(vErrors === null){
vErrors = [err28];
}
else {
vErrors.push(err28);
}
errors++;
}
const len1 = data12.length;
for(let i2=0; i2<len1; i2++){
let data13 = data12[i2];
if(typeof data13 === "string"){
if(func1(data13) < 1){
const err29 = {instancePath:instancePath+"/source_ids/" + i2,schemaPath:"#/$defs/source_ids/items/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err29];
}
else {
vErrors.push(err29);
}
errors++;
}
}
else {
const err30 = {instancePath:instancePath+"/source_ids/" + i2,schemaPath:"#/$defs/source_ids/items/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err30];
}
else {
vErrors.push(err30);
}
errors++;
}
}
let i3 = data12.length;
let j1;
if(i3 > 1){
const indices1 = {};
for(;i3--;){
let item1 = data12[i3];
if(typeof item1 !== "string"){
continue;
}
if(typeof indices1[item1] == "number"){
j1 = indices1[item1];
const err31 = {instancePath:instancePath+"/source_ids",schemaPath:"#/$defs/source_ids/uniqueItems",keyword:"uniqueItems",params:{i: i3, j: j1},message:"must NOT have duplicate items (items ## "+j1+" and "+i3+" are identical)"};
if(vErrors === null){
vErrors = [err31];
}
else {
vErrors.push(err31);
}
errors++;
break;
}
indices1[item1] = i3;
}
}
}
else {
const err32 = {instancePath:instancePath+"/source_ids",schemaPath:"#/$defs/source_ids/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err32];
}
else {
vErrors.push(err32);
}
errors++;
}
}
}
else {
const err33 = {instancePath,schemaPath:"#/oneOf/0/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err33];
}
else {
vErrors.push(err33);
}
errors++;
}
var _valid0 = _errs1 === errors;
if(_valid0){
valid0 = true;
passing0 = 0;
var props3 = true;
}
const _errs49 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.kind === undefined){
const err34 = {instancePath,schemaPath:"#/oneOf/1/required",keyword:"required",params:{missingProperty: "kind"},message:"must have required property '"+"kind"+"'"};
if(vErrors === null){
vErrors = [err34];
}
else {
vErrors.push(err34);
}
errors++;
}
if(data.items === undefined){
const err35 = {instancePath,schemaPath:"#/oneOf/1/required",keyword:"required",params:{missingProperty: "items"},message:"must have required property '"+"items"+"'"};
if(vErrors === null){
vErrors = [err35];
}
else {
vErrors.push(err35);
}
errors++;
}
for(const key1 in data){
if(!((key1 === "kind") || (key1 === "items"))){
const err36 = {instancePath,schemaPath:"#/oneOf/1/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err36];
}
else {
vErrors.push(err36);
}
errors++;
}
}
if(data.kind !== undefined){
let data14 = data.kind;
if(!((data14 === "all") || (data14 === "any"))){
const err37 = {instancePath:instancePath+"/kind",schemaPath:"#/oneOf/1/properties/kind/enum",keyword:"enum",params:{allowedValues: schema40.oneOf[1].properties.kind.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err37];
}
else {
vErrors.push(err37);
}
errors++;
}
}
if(data.items !== undefined){
let data15 = data.items;
if(Array.isArray(data15)){
if(data15.length < 1){
const err38 = {instancePath:instancePath+"/items",schemaPath:"#/oneOf/1/properties/items/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"};
if(vErrors === null){
vErrors = [err38];
}
else {
vErrors.push(err38);
}
errors++;
}
const len2 = data15.length;
for(let i4=0; i4<len2; i4++){
if(!(wrapper0.validate(data15[i4], {instancePath:instancePath+"/items/" + i4,parentData:data15,parentDataProperty:i4,rootData,dynamicAnchors}))){
vErrors = vErrors === null ? wrapper0.validate.errors : vErrors.concat(wrapper0.validate.errors);
errors = vErrors.length;
}
}
}
else {
const err39 = {instancePath:instancePath+"/items",schemaPath:"#/oneOf/1/properties/items/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err39];
}
else {
vErrors.push(err39);
}
errors++;
}
}
}
else {
const err40 = {instancePath,schemaPath:"#/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err40];
}
else {
vErrors.push(err40);
}
errors++;
}
var _valid0 = _errs49 === errors;
if(_valid0 && valid0){
valid0 = false;
passing0 = [passing0, 1];
}
else {
if(_valid0){
valid0 = true;
passing0 = 1;
if(props3 !== true){
props3 = true;
}
}
const _errs56 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.kind === undefined){
const err41 = {instancePath,schemaPath:"#/oneOf/2/required",keyword:"required",params:{missingProperty: "kind"},message:"must have required property '"+"kind"+"'"};
if(vErrors === null){
vErrors = [err41];
}
else {
vErrors.push(err41);
}
errors++;
}
if(data.item === undefined){
const err42 = {instancePath,schemaPath:"#/oneOf/2/required",keyword:"required",params:{missingProperty: "item"},message:"must have required property '"+"item"+"'"};
if(vErrors === null){
vErrors = [err42];
}
else {
vErrors.push(err42);
}
errors++;
}
for(const key2 in data){
if(!((key2 === "kind") || (key2 === "item"))){
const err43 = {instancePath,schemaPath:"#/oneOf/2/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key2},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err43];
}
else {
vErrors.push(err43);
}
errors++;
}
}
if(data.kind !== undefined){
if("not" !== data.kind){
const err44 = {instancePath:instancePath+"/kind",schemaPath:"#/oneOf/2/properties/kind/const",keyword:"const",params:{allowedValue: "not"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err44];
}
else {
vErrors.push(err44);
}
errors++;
}
}
if(data.item !== undefined){
if(!(wrapper0.validate(data.item, {instancePath:instancePath+"/item",parentData:data,parentDataProperty:"item",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? wrapper0.validate.errors : vErrors.concat(wrapper0.validate.errors);
errors = vErrors.length;
}
}
}
else {
const err45 = {instancePath,schemaPath:"#/oneOf/2/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err45];
}
else {
vErrors.push(err45);
}
errors++;
}
var _valid0 = _errs56 === errors;
if(_valid0 && valid0){
valid0 = false;
passing0 = [passing0, 2];
}
else {
if(_valid0){
valid0 = true;
passing0 = 2;
if(props3 !== true){
props3 = true;
}
}
}
}
if(!valid0){
const err46 = {instancePath,schemaPath:"#/oneOf",keyword:"oneOf",params:{passingSchemas: passing0},message:"must match exactly one schema in oneOf"};
if(vErrors === null){
vErrors = [err46];
}
else {
vErrors.push(err46);
}
errors++;
}
else {
errors = _errs0;
if(vErrors !== null){
if(_errs0){
vErrors.length = _errs0;
}
else {
vErrors = null;
}
}
}
validate24.errors = vErrors;
evaluated0.props = props3;
return errors === 0;
}
validate24.evaluated = {"dynamicProps":true,"dynamicItems":false};


function validate21(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
let vErrors = null;
let errors = 0;
const evaluated0 = validate21.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
const _errs2 = errors;
let valid1 = true;
const _errs3 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.billing_system !== undefined){
if("HZV" !== data.billing_system){
const err0 = {};
if(vErrors === null){
vErrors = [err0];
}
else {
vErrors.push(err0);
}
errors++;
}
}
}
var _valid0 = _errs3 === errors;
errors = _errs2;
if(vErrors !== null){
if(_errs2){
vErrors.length = _errs2;
}
else {
vErrors = null;
}
}
if(_valid0){
const _errs5 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.contract_id !== undefined){
let data1 = data.contract_id;
if(typeof data1 === "string"){
if(func1(data1) < 1){
const err1 = {instancePath:instancePath+"/contract_id",schemaPath:"#/allOf/0/then/properties/contract_id/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err1];
}
else {
vErrors.push(err1);
}
errors++;
}
}
else {
const err2 = {instancePath:instancePath+"/contract_id",schemaPath:"#/allOf/0/then/properties/contract_id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err2];
}
else {
vErrors.push(err2);
}
errors++;
}
}
}
var _valid0 = _errs5 === errors;
valid1 = _valid0;
if(valid1){
var props0 = {};
props0.contract_id = true;
props0.billing_system = true;
}
}
if(!valid1){
const err3 = {instancePath,schemaPath:"#/allOf/0/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err3];
}
else {
vErrors.push(err3);
}
errors++;
}
const _errs9 = errors;
let valid4 = true;
const _errs10 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.billing_system !== undefined){
if("KV" !== data.billing_system){
const err4 = {};
if(vErrors === null){
vErrors = [err4];
}
else {
vErrors.push(err4);
}
errors++;
}
}
}
var _valid1 = _errs10 === errors;
errors = _errs9;
if(vErrors !== null){
if(_errs9){
vErrors.length = _errs9;
}
else {
vErrors = null;
}
}
if(_valid1){
const _errs12 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.jurisdiction !== undefined){
let data3 = data.jurisdiction;
if(!((data3 === "Nordrhein") || (data3 === "Westfalen-Lippe"))){
const err5 = {instancePath:instancePath+"/jurisdiction",schemaPath:"#/allOf/1/then/properties/jurisdiction/enum",keyword:"enum",params:{allowedValues: schema32.allOf[1].then.properties.jurisdiction.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err5];
}
else {
vErrors.push(err5);
}
errors++;
}
}
}
var _valid1 = _errs12 === errors;
valid4 = _valid1;
if(valid4){
var props1 = {};
props1.jurisdiction = true;
props1.billing_system = true;
}
}
if(!valid4){
const err6 = {instancePath,schemaPath:"#/allOf/1/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err6];
}
else {
vErrors.push(err6);
}
errors++;
}
if(props0 !== true && props1 !== undefined){
if(props1 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props1);
}
}
const _errs15 = errors;
let valid7 = true;
const _errs16 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.billing_system !== undefined){
if("DEMO" !== data.billing_system){
const err7 = {};
if(vErrors === null){
vErrors = [err7];
}
else {
vErrors.push(err7);
}
errors++;
}
}
}
var _valid2 = _errs16 === errors;
errors = _errs15;
if(vErrors !== null){
if(_errs15){
vErrors.length = _errs15;
}
else {
vErrors = null;
}
}
if(_valid2){
const _errs18 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.status !== undefined){
if("draft" !== data.status){
const err8 = {instancePath:instancePath+"/status",schemaPath:"#/allOf/2/then/properties/status/const",keyword:"const",params:{allowedValue: "draft"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err8];
}
else {
vErrors.push(err8);
}
errors++;
}
}
if(data.id !== undefined){
let data6 = data.id;
if(typeof data6 === "string"){
if(!pattern4.test(data6)){
const err9 = {instancePath:instancePath+"/id",schemaPath:"#/allOf/2/then/properties/id/pattern",keyword:"pattern",params:{pattern: "^DEMO_"},message:"must match pattern \""+"^DEMO_"+"\""};
if(vErrors === null){
vErrors = [err9];
}
else {
vErrors.push(err9);
}
errors++;
}
}
}
if(data.procedure_codes !== undefined){
let data7 = data.procedure_codes;
if(Array.isArray(data7)){
const len0 = data7.length;
for(let i0=0; i0<len0; i0++){
let data8 = data7[i0];
if(typeof data8 === "string"){
if(!pattern4.test(data8)){
const err10 = {instancePath:instancePath+"/procedure_codes/" + i0,schemaPath:"#/allOf/2/then/properties/procedure_codes/items/pattern",keyword:"pattern",params:{pattern: "^DEMO_"},message:"must match pattern \""+"^DEMO_"+"\""};
if(vErrors === null){
vErrors = [err10];
}
else {
vErrors.push(err10);
}
errors++;
}
}
}
}
}
}
var _valid2 = _errs18 === errors;
valid7 = _valid2;
if(valid7){
var props2 = {};
props2.status = true;
props2.id = true;
props2.procedure_codes = true;
props2.billing_system = true;
}
}
if(!valid7){
const err11 = {instancePath,schemaPath:"#/allOf/2/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err11];
}
else {
vErrors.push(err11);
}
errors++;
}
if(props0 !== true && props2 !== undefined){
if(props2 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props2);
}
}
const _errs24 = errors;
let valid12 = true;
const _errs25 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.status !== undefined){
if("active" !== data.status){
const err12 = {};
if(vErrors === null){
vErrors = [err12];
}
else {
vErrors.push(err12);
}
errors++;
}
}
}
var _valid3 = _errs25 === errors;
errors = _errs24;
if(vErrors !== null){
if(_errs24){
vErrors.length = _errs24;
}
else {
vErrors = null;
}
}
if(_valid3){
const _errs27 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.billing_system !== undefined){
let data10 = data.billing_system;
if(!((((data10 === "EBM") || (data10 === "GOAE")) || (data10 === "HZV")) || (data10 === "KV"))){
const err13 = {instancePath:instancePath+"/billing_system",schemaPath:"#/allOf/3/then/properties/billing_system/enum",keyword:"enum",params:{allowedValues: schema32.allOf[3].then.properties.billing_system.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err13];
}
else {
vErrors.push(err13);
}
errors++;
}
}
if(data.jurisdiction !== undefined){
let data11 = data.jurisdiction;
if(!(((data11 === "DE") || (data11 === "Nordrhein")) || (data11 === "Westfalen-Lippe"))){
const err14 = {instancePath:instancePath+"/jurisdiction",schemaPath:"#/allOf/3/then/properties/jurisdiction/enum",keyword:"enum",params:{allowedValues: schema32.allOf[3].then.properties.jurisdiction.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err14];
}
else {
vErrors.push(err14);
}
errors++;
}
}
if(data.reviews !== undefined){
let data12 = data.reviews;
if(data12 && typeof data12 == "object" && !Array.isArray(data12)){
if(data12.billing !== undefined){
let data13 = data12.billing;
if(data13 && typeof data13 == "object" && !Array.isArray(data13)){
if(data13.state !== undefined){
if("approved" !== data13.state){
const err15 = {instancePath:instancePath+"/reviews/billing/state",schemaPath:"#/allOf/3/then/properties/reviews/properties/billing/properties/state/const",keyword:"const",params:{allowedValue: "approved"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err15];
}
else {
vErrors.push(err15);
}
errors++;
}
}
}
}
if(data12.clinical !== undefined){
let data15 = data12.clinical;
if(data15 && typeof data15 == "object" && !Array.isArray(data15)){
if(data15.state !== undefined){
let data16 = data15.state;
if(!((data16 === "approved") || (data16 === "not_applicable"))){
const err16 = {instancePath:instancePath+"/reviews/clinical/state",schemaPath:"#/allOf/3/then/properties/reviews/properties/clinical/properties/state/enum",keyword:"enum",params:{allowedValues: schema32.allOf[3].then.properties.reviews.properties.clinical.properties.state.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err16];
}
else {
vErrors.push(err16);
}
errors++;
}
}
}
}
}
}
if(data.sources !== undefined){
let data17 = data.sources;
if(Array.isArray(data17)){
const len1 = data17.length;
for(let i1=0; i1<len1; i1++){
let data18 = data17[i1];
if(data18 && typeof data18 == "object" && !Array.isArray(data18)){
if(data18.kind !== undefined){
let data19 = data18.kind;
if(!((((data19 === "legal_text") || (data19 === "official_catalogue")) || (data19 === "contract")) || (data19 === "official_guidance"))){
const err17 = {instancePath:instancePath+"/sources/" + i1+"/kind",schemaPath:"#/allOf/3/then/properties/sources/items/properties/kind/enum",keyword:"enum",params:{allowedValues: schema32.allOf[3].then.properties.sources.items.properties.kind.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err17];
}
else {
vErrors.push(err17);
}
errors++;
}
}
if(data18.license_status !== undefined){
let data20 = data18.license_status;
if(!((data20 === "permitted_for_local_use") || (data20 === "permitted_for_distribution"))){
const err18 = {instancePath:instancePath+"/sources/" + i1+"/license_status",schemaPath:"#/allOf/3/then/properties/sources/items/properties/license_status/enum",keyword:"enum",params:{allowedValues: schema32.allOf[3].then.properties.sources.items.properties.license_status.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err18];
}
else {
vErrors.push(err18);
}
errors++;
}
}
}
}
}
}
}
var _valid3 = _errs27 === errors;
valid12 = _valid3;
if(valid12){
var props3 = {};
props3.billing_system = true;
props3.jurisdiction = true;
props3.reviews = true;
props3.sources = true;
props3.status = true;
}
}
if(!valid12){
const err19 = {instancePath,schemaPath:"#/allOf/3/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err19];
}
else {
vErrors.push(err19);
}
errors++;
}
if(props0 !== true && props3 !== undefined){
if(props3 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props3);
}
}
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.id === undefined){
const err20 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err20];
}
else {
vErrors.push(err20);
}
errors++;
}
if(data.version === undefined){
const err21 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "version"},message:"must have required property '"+"version"+"'"};
if(vErrors === null){
vErrors = [err21];
}
else {
vErrors.push(err21);
}
errors++;
}
if(data.billing_system === undefined){
const err22 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "billing_system"},message:"must have required property '"+"billing_system"+"'"};
if(vErrors === null){
vErrors = [err22];
}
else {
vErrors.push(err22);
}
errors++;
}
if(data.status === undefined){
const err23 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "status"},message:"must have required property '"+"status"+"'"};
if(vErrors === null){
vErrors = [err23];
}
else {
vErrors.push(err23);
}
errors++;
}
if(data.title === undefined){
const err24 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "title"},message:"must have required property '"+"title"+"'"};
if(vErrors === null){
vErrors = [err24];
}
else {
vErrors.push(err24);
}
errors++;
}
if(data.procedure_codes === undefined){
const err25 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "procedure_codes"},message:"must have required property '"+"procedure_codes"+"'"};
if(vErrors === null){
vErrors = [err25];
}
else {
vErrors.push(err25);
}
errors++;
}
if(data.valid_from === undefined){
const err26 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "valid_from"},message:"must have required property '"+"valid_from"+"'"};
if(vErrors === null){
vErrors = [err26];
}
else {
vErrors.push(err26);
}
errors++;
}
if(data.valid_to === undefined){
const err27 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "valid_to"},message:"must have required property '"+"valid_to"+"'"};
if(vErrors === null){
vErrors = [err27];
}
else {
vErrors.push(err27);
}
errors++;
}
if(data.jurisdiction === undefined){
const err28 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "jurisdiction"},message:"must have required property '"+"jurisdiction"+"'"};
if(vErrors === null){
vErrors = [err28];
}
else {
vErrors.push(err28);
}
errors++;
}
if(data.contract_id === undefined){
const err29 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "contract_id"},message:"must have required property '"+"contract_id"+"'"};
if(vErrors === null){
vErrors = [err29];
}
else {
vErrors.push(err29);
}
errors++;
}
if(data.sources === undefined){
const err30 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "sources"},message:"must have required property '"+"sources"+"'"};
if(vErrors === null){
vErrors = [err30];
}
else {
vErrors.push(err30);
}
errors++;
}
if(data.reviews === undefined){
const err31 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "reviews"},message:"must have required property '"+"reviews"+"'"};
if(vErrors === null){
vErrors = [err31];
}
else {
vErrors.push(err31);
}
errors++;
}
if(data.required_context === undefined){
const err32 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "required_context"},message:"must have required property '"+"required_context"+"'"};
if(vErrors === null){
vErrors = [err32];
}
else {
vErrors.push(err32);
}
errors++;
}
if(data.eligibility === undefined){
const err33 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "eligibility"},message:"must have required property '"+"eligibility"+"'"};
if(vErrors === null){
vErrors = [err33];
}
else {
vErrors.push(err33);
}
errors++;
}
if(data.combination_rules === undefined){
const err34 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "combination_rules"},message:"must have required property '"+"combination_rules"+"'"};
if(vErrors === null){
vErrors = [err34];
}
else {
vErrors.push(err34);
}
errors++;
}
if(data.frequency_limits === undefined){
const err35 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "frequency_limits"},message:"must have required property '"+"frequency_limits"+"'"};
if(vErrors === null){
vErrors = [err35];
}
else {
vErrors.push(err35);
}
errors++;
}
if(data.result === undefined){
const err36 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "result"},message:"must have required property '"+"result"+"'"};
if(vErrors === null){
vErrors = [err36];
}
else {
vErrors.push(err36);
}
errors++;
}
for(const key0 in data){
if(!(func4.call(schema32.properties, key0))){
const err37 = {instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err37];
}
else {
vErrors.push(err37);
}
errors++;
}
}
if(data.id !== undefined){
let data21 = data.id;
if(typeof data21 === "string"){
if(func1(data21) < 1){
const err38 = {instancePath:instancePath+"/id",schemaPath:"#/properties/id/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err38];
}
else {
vErrors.push(err38);
}
errors++;
}
}
else {
const err39 = {instancePath:instancePath+"/id",schemaPath:"#/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err39];
}
else {
vErrors.push(err39);
}
errors++;
}
}
if(data.version !== undefined){
let data22 = data.version;
if(typeof data22 === "string"){
if(func1(data22) < 1){
const err40 = {instancePath:instancePath+"/version",schemaPath:"#/properties/version/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err40];
}
else {
vErrors.push(err40);
}
errors++;
}
}
else {
const err41 = {instancePath:instancePath+"/version",schemaPath:"#/properties/version/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err41];
}
else {
vErrors.push(err41);
}
errors++;
}
}
if(data.billing_system !== undefined){
let data23 = data.billing_system;
if(!(((((data23 === "EBM") || (data23 === "GOAE")) || (data23 === "HZV")) || (data23 === "KV")) || (data23 === "DEMO"))){
const err42 = {instancePath:instancePath+"/billing_system",schemaPath:"#/properties/billing_system/enum",keyword:"enum",params:{allowedValues: schema32.properties.billing_system.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err42];
}
else {
vErrors.push(err42);
}
errors++;
}
}
if(data.status !== undefined){
let data24 = data.status;
if(!((((data24 === "draft") || (data24 === "reviewed")) || (data24 === "active")) || (data24 === "retired"))){
const err43 = {instancePath:instancePath+"/status",schemaPath:"#/properties/status/enum",keyword:"enum",params:{allowedValues: schema32.properties.status.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err43];
}
else {
vErrors.push(err43);
}
errors++;
}
}
if(data.title !== undefined){
let data25 = data.title;
if(typeof data25 === "string"){
if(func1(data25) < 1){
const err44 = {instancePath:instancePath+"/title",schemaPath:"#/properties/title/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err44];
}
else {
vErrors.push(err44);
}
errors++;
}
}
else {
const err45 = {instancePath:instancePath+"/title",schemaPath:"#/properties/title/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err45];
}
else {
vErrors.push(err45);
}
errors++;
}
}
if(data.procedure_codes !== undefined){
let data26 = data.procedure_codes;
if(Array.isArray(data26)){
const len2 = data26.length;
for(let i2=0; i2<len2; i2++){
let data27 = data26[i2];
if(typeof data27 === "string"){
if(func1(data27) < 1){
const err46 = {instancePath:instancePath+"/procedure_codes/" + i2,schemaPath:"#/$defs/codes/items/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err46];
}
else {
vErrors.push(err46);
}
errors++;
}
}
else {
const err47 = {instancePath:instancePath+"/procedure_codes/" + i2,schemaPath:"#/$defs/codes/items/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err47];
}
else {
vErrors.push(err47);
}
errors++;
}
}
let i3 = data26.length;
let j0;
if(i3 > 1){
const indices0 = {};
for(;i3--;){
let item0 = data26[i3];
if(typeof item0 !== "string"){
continue;
}
if(typeof indices0[item0] == "number"){
j0 = indices0[item0];
const err48 = {instancePath:instancePath+"/procedure_codes",schemaPath:"#/$defs/codes/uniqueItems",keyword:"uniqueItems",params:{i: i3, j: j0},message:"must NOT have duplicate items (items ## "+j0+" and "+i3+" are identical)"};
if(vErrors === null){
vErrors = [err48];
}
else {
vErrors.push(err48);
}
errors++;
break;
}
indices0[item0] = i3;
}
}
}
else {
const err49 = {instancePath:instancePath+"/procedure_codes",schemaPath:"#/$defs/codes/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err49];
}
else {
vErrors.push(err49);
}
errors++;
}
if(Array.isArray(data26)){
if(data26.length < 1){
const err50 = {instancePath:instancePath+"/procedure_codes",schemaPath:"#/properties/procedure_codes/allOf/1/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"};
if(vErrors === null){
vErrors = [err50];
}
else {
vErrors.push(err50);
}
errors++;
}
}
}
if(data.valid_from !== undefined){
let data28 = data.valid_from;
if(typeof data28 === "string"){
if(!(formats0.validate(data28))){
const err51 = {instancePath:instancePath+"/valid_from",schemaPath:"#/$defs/date/format",keyword:"format",params:{format: "date"},message:"must match format \""+"date"+"\""};
if(vErrors === null){
vErrors = [err51];
}
else {
vErrors.push(err51);
}
errors++;
}
}
else {
const err52 = {instancePath:instancePath+"/valid_from",schemaPath:"#/$defs/date/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err52];
}
else {
vErrors.push(err52);
}
errors++;
}
}
if(data.valid_to !== undefined){
let data29 = data.valid_to;
if((typeof data29 !== "string") && (data29 !== null)){
const err53 = {instancePath:instancePath+"/valid_to",schemaPath:"#/properties/valid_to/type",keyword:"type",params:{type: schema32.properties.valid_to.type},message:"must be string,null"};
if(vErrors === null){
vErrors = [err53];
}
else {
vErrors.push(err53);
}
errors++;
}
if(typeof data29 === "string"){
if(!(formats0.validate(data29))){
const err54 = {instancePath:instancePath+"/valid_to",schemaPath:"#/properties/valid_to/format",keyword:"format",params:{format: "date"},message:"must match format \""+"date"+"\""};
if(vErrors === null){
vErrors = [err54];
}
else {
vErrors.push(err54);
}
errors++;
}
}
}
if(data.jurisdiction !== undefined){
let data30 = data.jurisdiction;
if(!((((data30 === "DE") || (data30 === "Nordrhein")) || (data30 === "Westfalen-Lippe")) || (data30 === "synthetic"))){
const err55 = {instancePath:instancePath+"/jurisdiction",schemaPath:"#/properties/jurisdiction/enum",keyword:"enum",params:{allowedValues: schema32.properties.jurisdiction.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err55];
}
else {
vErrors.push(err55);
}
errors++;
}
}
if(data.contract_id !== undefined){
let data31 = data.contract_id;
if((typeof data31 !== "string") && (data31 !== null)){
const err56 = {instancePath:instancePath+"/contract_id",schemaPath:"#/properties/contract_id/type",keyword:"type",params:{type: schema32.properties.contract_id.type},message:"must be string,null"};
if(vErrors === null){
vErrors = [err56];
}
else {
vErrors.push(err56);
}
errors++;
}
}
if(data.sources !== undefined){
let data32 = data.sources;
if(Array.isArray(data32)){
if(data32.length < 1){
const err57 = {instancePath:instancePath+"/sources",schemaPath:"#/properties/sources/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"};
if(vErrors === null){
vErrors = [err57];
}
else {
vErrors.push(err57);
}
errors++;
}
const len3 = data32.length;
for(let i4=0; i4<len3; i4++){
if(!(validate22(data32[i4], {instancePath:instancePath+"/sources/" + i4,parentData:data32,parentDataProperty:i4,rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);
errors = vErrors.length;
}
}
}
else {
const err58 = {instancePath:instancePath+"/sources",schemaPath:"#/properties/sources/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err58];
}
else {
vErrors.push(err58);
}
errors++;
}
}
if(data.reviews !== undefined){
let data34 = data.reviews;
if(data34 && typeof data34 == "object" && !Array.isArray(data34)){
if(data34.billing === undefined){
const err59 = {instancePath:instancePath+"/reviews",schemaPath:"#/properties/reviews/required",keyword:"required",params:{missingProperty: "billing"},message:"must have required property '"+"billing"+"'"};
if(vErrors === null){
vErrors = [err59];
}
else {
vErrors.push(err59);
}
errors++;
}
if(data34.clinical === undefined){
const err60 = {instancePath:instancePath+"/reviews",schemaPath:"#/properties/reviews/required",keyword:"required",params:{missingProperty: "clinical"},message:"must have required property '"+"clinical"+"'"};
if(vErrors === null){
vErrors = [err60];
}
else {
vErrors.push(err60);
}
errors++;
}
for(const key1 in data34){
if(!((key1 === "billing") || (key1 === "clinical"))){
const err61 = {instancePath:instancePath+"/reviews",schemaPath:"#/properties/reviews/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err61];
}
else {
vErrors.push(err61);
}
errors++;
}
}
if(data34.billing !== undefined){
let data35 = data34.billing;
const _errs73 = errors;
let valid33 = true;
const _errs74 = errors;
if(data35 && typeof data35 == "object" && !Array.isArray(data35)){
if(data35.state !== undefined){
let data36 = data35.state;
if(!((data36 === "approved") || (data36 === "not_applicable"))){
const err62 = {};
if(vErrors === null){
vErrors = [err62];
}
else {
vErrors.push(err62);
}
errors++;
}
}
}
var _valid4 = _errs74 === errors;
errors = _errs73;
if(vErrors !== null){
if(_errs73){
vErrors.length = _errs73;
}
else {
vErrors = null;
}
}
if(_valid4){
const _errs76 = errors;
if(data35 && typeof data35 == "object" && !Array.isArray(data35)){
if(data35.reviewer !== undefined){
let data37 = data35.reviewer;
if(typeof data37 === "string"){
if(func1(data37) < 1){
const err63 = {instancePath:instancePath+"/reviews/billing/reviewer",schemaPath:"#/$defs/review/allOf/0/then/properties/reviewer/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err63];
}
else {
vErrors.push(err63);
}
errors++;
}
}
else {
const err64 = {instancePath:instancePath+"/reviews/billing/reviewer",schemaPath:"#/$defs/review/allOf/0/then/properties/reviewer/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err64];
}
else {
vErrors.push(err64);
}
errors++;
}
}
if(data35.reviewed_at !== undefined){
let data38 = data35.reviewed_at;
if(typeof data38 === "string"){
if(!(formats8.validate(data38))){
const err65 = {instancePath:instancePath+"/reviews/billing/reviewed_at",schemaPath:"#/$defs/review/allOf/0/then/properties/reviewed_at/format",keyword:"format",params:{format: "date-time"},message:"must match format \""+"date-time"+"\""};
if(vErrors === null){
vErrors = [err65];
}
else {
vErrors.push(err65);
}
errors++;
}
}
else {
const err66 = {instancePath:instancePath+"/reviews/billing/reviewed_at",schemaPath:"#/$defs/review/allOf/0/then/properties/reviewed_at/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err66];
}
else {
vErrors.push(err66);
}
errors++;
}
}
if(data35.rationale !== undefined){
let data39 = data35.rationale;
if(typeof data39 === "string"){
if(func1(data39) < 1){
const err67 = {instancePath:instancePath+"/reviews/billing/rationale",schemaPath:"#/$defs/review/allOf/0/then/properties/rationale/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err67];
}
else {
vErrors.push(err67);
}
errors++;
}
}
else {
const err68 = {instancePath:instancePath+"/reviews/billing/rationale",schemaPath:"#/$defs/review/allOf/0/then/properties/rationale/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err68];
}
else {
vErrors.push(err68);
}
errors++;
}
}
}
var _valid4 = _errs76 === errors;
valid33 = _valid4;
if(valid33){
var props4 = {};
props4.reviewer = true;
props4.reviewed_at = true;
props4.rationale = true;
props4.state = true;
}
}
if(!valid33){
const err69 = {instancePath:instancePath+"/reviews/billing",schemaPath:"#/$defs/review/allOf/0/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err69];
}
else {
vErrors.push(err69);
}
errors++;
}
if(data35 && typeof data35 == "object" && !Array.isArray(data35)){
if(data35.state === undefined){
const err70 = {instancePath:instancePath+"/reviews/billing",schemaPath:"#/$defs/review/required",keyword:"required",params:{missingProperty: "state"},message:"must have required property '"+"state"+"'"};
if(vErrors === null){
vErrors = [err70];
}
else {
vErrors.push(err70);
}
errors++;
}
if(data35.reviewer === undefined){
const err71 = {instancePath:instancePath+"/reviews/billing",schemaPath:"#/$defs/review/required",keyword:"required",params:{missingProperty: "reviewer"},message:"must have required property '"+"reviewer"+"'"};
if(vErrors === null){
vErrors = [err71];
}
else {
vErrors.push(err71);
}
errors++;
}
if(data35.reviewed_at === undefined){
const err72 = {instancePath:instancePath+"/reviews/billing",schemaPath:"#/$defs/review/required",keyword:"required",params:{missingProperty: "reviewed_at"},message:"must have required property '"+"reviewed_at"+"'"};
if(vErrors === null){
vErrors = [err72];
}
else {
vErrors.push(err72);
}
errors++;
}
if(data35.rationale === undefined){
const err73 = {instancePath:instancePath+"/reviews/billing",schemaPath:"#/$defs/review/required",keyword:"required",params:{missingProperty: "rationale"},message:"must have required property '"+"rationale"+"'"};
if(vErrors === null){
vErrors = [err73];
}
else {
vErrors.push(err73);
}
errors++;
}
for(const key2 in data35){
if(!((((key2 === "state") || (key2 === "reviewer")) || (key2 === "reviewed_at")) || (key2 === "rationale"))){
const err74 = {instancePath:instancePath+"/reviews/billing",schemaPath:"#/$defs/review/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key2},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err74];
}
else {
vErrors.push(err74);
}
errors++;
}
}
if(data35.state !== undefined){
let data40 = data35.state;
if(!((((data40 === "pending") || (data40 === "approved")) || (data40 === "rejected")) || (data40 === "not_applicable"))){
const err75 = {instancePath:instancePath+"/reviews/billing/state",schemaPath:"#/$defs/review/properties/state/enum",keyword:"enum",params:{allowedValues: schema37.properties.state.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err75];
}
else {
vErrors.push(err75);
}
errors++;
}
}
if(data35.reviewer !== undefined){
let data41 = data35.reviewer;
if((typeof data41 !== "string") && (data41 !== null)){
const err76 = {instancePath:instancePath+"/reviews/billing/reviewer",schemaPath:"#/$defs/review/properties/reviewer/type",keyword:"type",params:{type: schema37.properties.reviewer.type},message:"must be string,null"};
if(vErrors === null){
vErrors = [err76];
}
else {
vErrors.push(err76);
}
errors++;
}
}
if(data35.reviewed_at !== undefined){
let data42 = data35.reviewed_at;
if((typeof data42 !== "string") && (data42 !== null)){
const err77 = {instancePath:instancePath+"/reviews/billing/reviewed_at",schemaPath:"#/$defs/review/properties/reviewed_at/type",keyword:"type",params:{type: schema37.properties.reviewed_at.type},message:"must be string,null"};
if(vErrors === null){
vErrors = [err77];
}
else {
vErrors.push(err77);
}
errors++;
}
if(typeof data42 === "string"){
if(!(formats8.validate(data42))){
const err78 = {instancePath:instancePath+"/reviews/billing/reviewed_at",schemaPath:"#/$defs/review/properties/reviewed_at/format",keyword:"format",params:{format: "date-time"},message:"must match format \""+"date-time"+"\""};
if(vErrors === null){
vErrors = [err78];
}
else {
vErrors.push(err78);
}
errors++;
}
}
}
if(data35.rationale !== undefined){
let data43 = data35.rationale;
if((typeof data43 !== "string") && (data43 !== null)){
const err79 = {instancePath:instancePath+"/reviews/billing/rationale",schemaPath:"#/$defs/review/properties/rationale/type",keyword:"type",params:{type: schema37.properties.rationale.type},message:"must be string,null"};
if(vErrors === null){
vErrors = [err79];
}
else {
vErrors.push(err79);
}
errors++;
}
}
}
else {
const err80 = {instancePath:instancePath+"/reviews/billing",schemaPath:"#/$defs/review/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err80];
}
else {
vErrors.push(err80);
}
errors++;
}
}
if(data34.clinical !== undefined){
let data44 = data34.clinical;
const _errs95 = errors;
let valid39 = true;
const _errs96 = errors;
if(data44 && typeof data44 == "object" && !Array.isArray(data44)){
if(data44.state !== undefined){
let data45 = data44.state;
if(!((data45 === "approved") || (data45 === "not_applicable"))){
const err81 = {};
if(vErrors === null){
vErrors = [err81];
}
else {
vErrors.push(err81);
}
errors++;
}
}
}
var _valid5 = _errs96 === errors;
errors = _errs95;
if(vErrors !== null){
if(_errs95){
vErrors.length = _errs95;
}
else {
vErrors = null;
}
}
if(_valid5){
const _errs98 = errors;
if(data44 && typeof data44 == "object" && !Array.isArray(data44)){
if(data44.reviewer !== undefined){
let data46 = data44.reviewer;
if(typeof data46 === "string"){
if(func1(data46) < 1){
const err82 = {instancePath:instancePath+"/reviews/clinical/reviewer",schemaPath:"#/$defs/review/allOf/0/then/properties/reviewer/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err82];
}
else {
vErrors.push(err82);
}
errors++;
}
}
else {
const err83 = {instancePath:instancePath+"/reviews/clinical/reviewer",schemaPath:"#/$defs/review/allOf/0/then/properties/reviewer/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err83];
}
else {
vErrors.push(err83);
}
errors++;
}
}
if(data44.reviewed_at !== undefined){
let data47 = data44.reviewed_at;
if(typeof data47 === "string"){
if(!(formats8.validate(data47))){
const err84 = {instancePath:instancePath+"/reviews/clinical/reviewed_at",schemaPath:"#/$defs/review/allOf/0/then/properties/reviewed_at/format",keyword:"format",params:{format: "date-time"},message:"must match format \""+"date-time"+"\""};
if(vErrors === null){
vErrors = [err84];
}
else {
vErrors.push(err84);
}
errors++;
}
}
else {
const err85 = {instancePath:instancePath+"/reviews/clinical/reviewed_at",schemaPath:"#/$defs/review/allOf/0/then/properties/reviewed_at/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err85];
}
else {
vErrors.push(err85);
}
errors++;
}
}
if(data44.rationale !== undefined){
let data48 = data44.rationale;
if(typeof data48 === "string"){
if(func1(data48) < 1){
const err86 = {instancePath:instancePath+"/reviews/clinical/rationale",schemaPath:"#/$defs/review/allOf/0/then/properties/rationale/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err86];
}
else {
vErrors.push(err86);
}
errors++;
}
}
else {
const err87 = {instancePath:instancePath+"/reviews/clinical/rationale",schemaPath:"#/$defs/review/allOf/0/then/properties/rationale/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err87];
}
else {
vErrors.push(err87);
}
errors++;
}
}
}
var _valid5 = _errs98 === errors;
valid39 = _valid5;
if(valid39){
var props5 = {};
props5.reviewer = true;
props5.reviewed_at = true;
props5.rationale = true;
props5.state = true;
}
}
if(!valid39){
const err88 = {instancePath:instancePath+"/reviews/clinical",schemaPath:"#/$defs/review/allOf/0/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err88];
}
else {
vErrors.push(err88);
}
errors++;
}
if(data44 && typeof data44 == "object" && !Array.isArray(data44)){
if(data44.state === undefined){
const err89 = {instancePath:instancePath+"/reviews/clinical",schemaPath:"#/$defs/review/required",keyword:"required",params:{missingProperty: "state"},message:"must have required property '"+"state"+"'"};
if(vErrors === null){
vErrors = [err89];
}
else {
vErrors.push(err89);
}
errors++;
}
if(data44.reviewer === undefined){
const err90 = {instancePath:instancePath+"/reviews/clinical",schemaPath:"#/$defs/review/required",keyword:"required",params:{missingProperty: "reviewer"},message:"must have required property '"+"reviewer"+"'"};
if(vErrors === null){
vErrors = [err90];
}
else {
vErrors.push(err90);
}
errors++;
}
if(data44.reviewed_at === undefined){
const err91 = {instancePath:instancePath+"/reviews/clinical",schemaPath:"#/$defs/review/required",keyword:"required",params:{missingProperty: "reviewed_at"},message:"must have required property '"+"reviewed_at"+"'"};
if(vErrors === null){
vErrors = [err91];
}
else {
vErrors.push(err91);
}
errors++;
}
if(data44.rationale === undefined){
const err92 = {instancePath:instancePath+"/reviews/clinical",schemaPath:"#/$defs/review/required",keyword:"required",params:{missingProperty: "rationale"},message:"must have required property '"+"rationale"+"'"};
if(vErrors === null){
vErrors = [err92];
}
else {
vErrors.push(err92);
}
errors++;
}
for(const key3 in data44){
if(!((((key3 === "state") || (key3 === "reviewer")) || (key3 === "reviewed_at")) || (key3 === "rationale"))){
const err93 = {instancePath:instancePath+"/reviews/clinical",schemaPath:"#/$defs/review/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key3},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err93];
}
else {
vErrors.push(err93);
}
errors++;
}
}
if(data44.state !== undefined){
let data49 = data44.state;
if(!((((data49 === "pending") || (data49 === "approved")) || (data49 === "rejected")) || (data49 === "not_applicable"))){
const err94 = {instancePath:instancePath+"/reviews/clinical/state",schemaPath:"#/$defs/review/properties/state/enum",keyword:"enum",params:{allowedValues: schema37.properties.state.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err94];
}
else {
vErrors.push(err94);
}
errors++;
}
}
if(data44.reviewer !== undefined){
let data50 = data44.reviewer;
if((typeof data50 !== "string") && (data50 !== null)){
const err95 = {instancePath:instancePath+"/reviews/clinical/reviewer",schemaPath:"#/$defs/review/properties/reviewer/type",keyword:"type",params:{type: schema37.properties.reviewer.type},message:"must be string,null"};
if(vErrors === null){
vErrors = [err95];
}
else {
vErrors.push(err95);
}
errors++;
}
}
if(data44.reviewed_at !== undefined){
let data51 = data44.reviewed_at;
if((typeof data51 !== "string") && (data51 !== null)){
const err96 = {instancePath:instancePath+"/reviews/clinical/reviewed_at",schemaPath:"#/$defs/review/properties/reviewed_at/type",keyword:"type",params:{type: schema37.properties.reviewed_at.type},message:"must be string,null"};
if(vErrors === null){
vErrors = [err96];
}
else {
vErrors.push(err96);
}
errors++;
}
if(typeof data51 === "string"){
if(!(formats8.validate(data51))){
const err97 = {instancePath:instancePath+"/reviews/clinical/reviewed_at",schemaPath:"#/$defs/review/properties/reviewed_at/format",keyword:"format",params:{format: "date-time"},message:"must match format \""+"date-time"+"\""};
if(vErrors === null){
vErrors = [err97];
}
else {
vErrors.push(err97);
}
errors++;
}
}
}
if(data44.rationale !== undefined){
let data52 = data44.rationale;
if((typeof data52 !== "string") && (data52 !== null)){
const err98 = {instancePath:instancePath+"/reviews/clinical/rationale",schemaPath:"#/$defs/review/properties/rationale/type",keyword:"type",params:{type: schema37.properties.rationale.type},message:"must be string,null"};
if(vErrors === null){
vErrors = [err98];
}
else {
vErrors.push(err98);
}
errors++;
}
}
}
else {
const err99 = {instancePath:instancePath+"/reviews/clinical",schemaPath:"#/$defs/review/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err99];
}
else {
vErrors.push(err99);
}
errors++;
}
}
}
else {
const err100 = {instancePath:instancePath+"/reviews",schemaPath:"#/properties/reviews/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err100];
}
else {
vErrors.push(err100);
}
errors++;
}
}
if(data.required_context !== undefined){
let data53 = data.required_context;
if(Array.isArray(data53)){
if(data53.length < 1){
const err101 = {instancePath:instancePath+"/required_context",schemaPath:"#/properties/required_context/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"};
if(vErrors === null){
vErrors = [err101];
}
else {
vErrors.push(err101);
}
errors++;
}
const len4 = data53.length;
for(let i5=0; i5<len4; i5++){
let data54 = data53[i5];
if(data54 && typeof data54 == "object" && !Array.isArray(data54)){
if(data54.domain === undefined){
const err102 = {instancePath:instancePath+"/required_context/" + i5,schemaPath:"#/properties/required_context/items/required",keyword:"required",params:{missingProperty: "domain"},message:"must have required property '"+"domain"+"'"};
if(vErrors === null){
vErrors = [err102];
}
else {
vErrors.push(err102);
}
errors++;
}
if(data54.window === undefined){
const err103 = {instancePath:instancePath+"/required_context/" + i5,schemaPath:"#/properties/required_context/items/required",keyword:"required",params:{missingProperty: "window"},message:"must have required property '"+"window"+"'"};
if(vErrors === null){
vErrors = [err103];
}
else {
vErrors.push(err103);
}
errors++;
}
for(const key4 in data54){
if(!((key4 === "domain") || (key4 === "window"))){
const err104 = {instancePath:instancePath+"/required_context/" + i5,schemaPath:"#/properties/required_context/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key4},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err104];
}
else {
vErrors.push(err104);
}
errors++;
}
}
if(data54.domain !== undefined){
let data55 = data54.domain;
if(!((((((data55 === "documentation") || (data55 === "billed_services")) || (data55 === "practice_authorizations")) || (data55 === "contract_terms")) || (data55 === "practice_participation")) || (data55 === "patient_enrollment"))){
const err105 = {instancePath:instancePath+"/required_context/" + i5+"/domain",schemaPath:"#/properties/required_context/items/properties/domain/enum",keyword:"enum",params:{allowedValues: schema32.properties.required_context.items.properties.domain.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err105];
}
else {
vErrors.push(err105);
}
errors++;
}
}
if(data54.window !== undefined){
let data56 = data54.window;
if(data56 && typeof data56 == "object" && !Array.isArray(data56)){
if(data56.unit === undefined){
const err106 = {instancePath:instancePath+"/required_context/" + i5+"/window",schemaPath:"#/$defs/window/required",keyword:"required",params:{missingProperty: "unit"},message:"must have required property '"+"unit"+"'"};
if(vErrors === null){
vErrors = [err106];
}
else {
vErrors.push(err106);
}
errors++;
}
if(data56.lookback_periods === undefined){
const err107 = {instancePath:instancePath+"/required_context/" + i5+"/window",schemaPath:"#/$defs/window/required",keyword:"required",params:{missingProperty: "lookback_periods"},message:"must have required property '"+"lookback_periods"+"'"};
if(vErrors === null){
vErrors = [err107];
}
else {
vErrors.push(err107);
}
errors++;
}
if(data56.anchor === undefined){
const err108 = {instancePath:instancePath+"/required_context/" + i5+"/window",schemaPath:"#/$defs/window/required",keyword:"required",params:{missingProperty: "anchor"},message:"must have required property '"+"anchor"+"'"};
if(vErrors === null){
vErrors = [err108];
}
else {
vErrors.push(err108);
}
errors++;
}
for(const key5 in data56){
if(!(((key5 === "unit") || (key5 === "lookback_periods")) || (key5 === "anchor"))){
const err109 = {instancePath:instancePath+"/required_context/" + i5+"/window",schemaPath:"#/$defs/window/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key5},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err109];
}
else {
vErrors.push(err109);
}
errors++;
}
}
if(data56.unit !== undefined){
let data57 = data56.unit;
if(!(((((data57 === "visit") || (data57 === "day")) || (data57 === "treatment_case")) || (data57 === "quarter")) || (data57 === "year"))){
const err110 = {instancePath:instancePath+"/required_context/" + i5+"/window/unit",schemaPath:"#/$defs/window/properties/unit/enum",keyword:"enum",params:{allowedValues: schema39.properties.unit.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err110];
}
else {
vErrors.push(err110);
}
errors++;
}
}
if(data56.lookback_periods !== undefined){
let data58 = data56.lookback_periods;
if(!(((typeof data58 == "number") && (!(data58 % 1) && !isNaN(data58))) && (isFinite(data58)))){
const err111 = {instancePath:instancePath+"/required_context/" + i5+"/window/lookback_periods",schemaPath:"#/$defs/window/properties/lookback_periods/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err111];
}
else {
vErrors.push(err111);
}
errors++;
}
if((typeof data58 == "number") && (isFinite(data58))){
if(data58 < 0 || isNaN(data58)){
const err112 = {instancePath:instancePath+"/required_context/" + i5+"/window/lookback_periods",schemaPath:"#/$defs/window/properties/lookback_periods/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err112];
}
else {
vErrors.push(err112);
}
errors++;
}
}
}
if(data56.anchor !== undefined){
if("service_date" !== data56.anchor){
const err113 = {instancePath:instancePath+"/required_context/" + i5+"/window/anchor",schemaPath:"#/$defs/window/properties/anchor/const",keyword:"const",params:{allowedValue: "service_date"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err113];
}
else {
vErrors.push(err113);
}
errors++;
}
}
}
else {
const err114 = {instancePath:instancePath+"/required_context/" + i5+"/window",schemaPath:"#/$defs/window/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err114];
}
else {
vErrors.push(err114);
}
errors++;
}
}
}
else {
const err115 = {instancePath:instancePath+"/required_context/" + i5,schemaPath:"#/properties/required_context/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err115];
}
else {
vErrors.push(err115);
}
errors++;
}
}
}
else {
const err116 = {instancePath:instancePath+"/required_context",schemaPath:"#/properties/required_context/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err116];
}
else {
vErrors.push(err116);
}
errors++;
}
}
if(data.eligibility !== undefined){
if(!(validate24(data.eligibility, {instancePath:instancePath+"/eligibility",parentData:data,parentDataProperty:"eligibility",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
errors = vErrors.length;
}
}
if(data.combination_rules !== undefined){
let data61 = data.combination_rules;
if(Array.isArray(data61)){
const len5 = data61.length;
for(let i6=0; i6<len5; i6++){
let data62 = data61[i6];
if(data62 && typeof data62 == "object" && !Array.isArray(data62)){
if(data62.relationship === undefined){
const err117 = {instancePath:instancePath+"/combination_rules/" + i6,schemaPath:"#/properties/combination_rules/items/required",keyword:"required",params:{missingProperty: "relationship"},message:"must have required property '"+"relationship"+"'"};
if(vErrors === null){
vErrors = [err117];
}
else {
vErrors.push(err117);
}
errors++;
}
if(data62.with_codes === undefined){
const err118 = {instancePath:instancePath+"/combination_rules/" + i6,schemaPath:"#/properties/combination_rules/items/required",keyword:"required",params:{missingProperty: "with_codes"},message:"must have required property '"+"with_codes"+"'"};
if(vErrors === null){
vErrors = [err118];
}
else {
vErrors.push(err118);
}
errors++;
}
if(data62.window === undefined){
const err119 = {instancePath:instancePath+"/combination_rules/" + i6,schemaPath:"#/properties/combination_rules/items/required",keyword:"required",params:{missingProperty: "window"},message:"must have required property '"+"window"+"'"};
if(vErrors === null){
vErrors = [err119];
}
else {
vErrors.push(err119);
}
errors++;
}
if(data62.reason === undefined){
const err120 = {instancePath:instancePath+"/combination_rules/" + i6,schemaPath:"#/properties/combination_rules/items/required",keyword:"required",params:{missingProperty: "reason"},message:"must have required property '"+"reason"+"'"};
if(vErrors === null){
vErrors = [err120];
}
else {
vErrors.push(err120);
}
errors++;
}
if(data62.source_ids === undefined){
const err121 = {instancePath:instancePath+"/combination_rules/" + i6,schemaPath:"#/properties/combination_rules/items/required",keyword:"required",params:{missingProperty: "source_ids"},message:"must have required property '"+"source_ids"+"'"};
if(vErrors === null){
vErrors = [err121];
}
else {
vErrors.push(err121);
}
errors++;
}
for(const key6 in data62){
if(!(((((key6 === "relationship") || (key6 === "with_codes")) || (key6 === "window")) || (key6 === "reason")) || (key6 === "source_ids"))){
const err122 = {instancePath:instancePath+"/combination_rules/" + i6,schemaPath:"#/properties/combination_rules/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key6},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err122];
}
else {
vErrors.push(err122);
}
errors++;
}
}
if(data62.relationship !== undefined){
let data63 = data62.relationship;
if(!((((data63 === "cannot_combine") || (data63 === "included_in")) || (data63 === "requires_code")) || (data63 === "excluded_by"))){
const err123 = {instancePath:instancePath+"/combination_rules/" + i6+"/relationship",schemaPath:"#/properties/combination_rules/items/properties/relationship/enum",keyword:"enum",params:{allowedValues: schema32.properties.combination_rules.items.properties.relationship.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err123];
}
else {
vErrors.push(err123);
}
errors++;
}
}
if(data62.with_codes !== undefined){
let data64 = data62.with_codes;
if(Array.isArray(data64)){
const len6 = data64.length;
for(let i7=0; i7<len6; i7++){
let data65 = data64[i7];
if(typeof data65 === "string"){
if(func1(data65) < 1){
const err124 = {instancePath:instancePath+"/combination_rules/" + i6+"/with_codes/" + i7,schemaPath:"#/$defs/codes/items/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err124];
}
else {
vErrors.push(err124);
}
errors++;
}
}
else {
const err125 = {instancePath:instancePath+"/combination_rules/" + i6+"/with_codes/" + i7,schemaPath:"#/$defs/codes/items/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err125];
}
else {
vErrors.push(err125);
}
errors++;
}
}
let i8 = data64.length;
let j1;
if(i8 > 1){
const indices1 = {};
for(;i8--;){
let item1 = data64[i8];
if(typeof item1 !== "string"){
continue;
}
if(typeof indices1[item1] == "number"){
j1 = indices1[item1];
const err126 = {instancePath:instancePath+"/combination_rules/" + i6+"/with_codes",schemaPath:"#/$defs/codes/uniqueItems",keyword:"uniqueItems",params:{i: i8, j: j1},message:"must NOT have duplicate items (items ## "+j1+" and "+i8+" are identical)"};
if(vErrors === null){
vErrors = [err126];
}
else {
vErrors.push(err126);
}
errors++;
break;
}
indices1[item1] = i8;
}
}
}
else {
const err127 = {instancePath:instancePath+"/combination_rules/" + i6+"/with_codes",schemaPath:"#/$defs/codes/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err127];
}
else {
vErrors.push(err127);
}
errors++;
}
if(Array.isArray(data64)){
if(data64.length < 1){
const err128 = {instancePath:instancePath+"/combination_rules/" + i6+"/with_codes",schemaPath:"#/properties/combination_rules/items/properties/with_codes/allOf/1/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"};
if(vErrors === null){
vErrors = [err128];
}
else {
vErrors.push(err128);
}
errors++;
}
}
}
if(data62.window !== undefined){
let data66 = data62.window;
if(data66 && typeof data66 == "object" && !Array.isArray(data66)){
if(data66.unit === undefined){
const err129 = {instancePath:instancePath+"/combination_rules/" + i6+"/window",schemaPath:"#/$defs/window/required",keyword:"required",params:{missingProperty: "unit"},message:"must have required property '"+"unit"+"'"};
if(vErrors === null){
vErrors = [err129];
}
else {
vErrors.push(err129);
}
errors++;
}
if(data66.lookback_periods === undefined){
const err130 = {instancePath:instancePath+"/combination_rules/" + i6+"/window",schemaPath:"#/$defs/window/required",keyword:"required",params:{missingProperty: "lookback_periods"},message:"must have required property '"+"lookback_periods"+"'"};
if(vErrors === null){
vErrors = [err130];
}
else {
vErrors.push(err130);
}
errors++;
}
if(data66.anchor === undefined){
const err131 = {instancePath:instancePath+"/combination_rules/" + i6+"/window",schemaPath:"#/$defs/window/required",keyword:"required",params:{missingProperty: "anchor"},message:"must have required property '"+"anchor"+"'"};
if(vErrors === null){
vErrors = [err131];
}
else {
vErrors.push(err131);
}
errors++;
}
for(const key7 in data66){
if(!(((key7 === "unit") || (key7 === "lookback_periods")) || (key7 === "anchor"))){
const err132 = {instancePath:instancePath+"/combination_rules/" + i6+"/window",schemaPath:"#/$defs/window/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key7},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err132];
}
else {
vErrors.push(err132);
}
errors++;
}
}
if(data66.unit !== undefined){
let data67 = data66.unit;
if(!(((((data67 === "visit") || (data67 === "day")) || (data67 === "treatment_case")) || (data67 === "quarter")) || (data67 === "year"))){
const err133 = {instancePath:instancePath+"/combination_rules/" + i6+"/window/unit",schemaPath:"#/$defs/window/properties/unit/enum",keyword:"enum",params:{allowedValues: schema39.properties.unit.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err133];
}
else {
vErrors.push(err133);
}
errors++;
}
}
if(data66.lookback_periods !== undefined){
let data68 = data66.lookback_periods;
if(!(((typeof data68 == "number") && (!(data68 % 1) && !isNaN(data68))) && (isFinite(data68)))){
const err134 = {instancePath:instancePath+"/combination_rules/" + i6+"/window/lookback_periods",schemaPath:"#/$defs/window/properties/lookback_periods/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err134];
}
else {
vErrors.push(err134);
}
errors++;
}
if((typeof data68 == "number") && (isFinite(data68))){
if(data68 < 0 || isNaN(data68)){
const err135 = {instancePath:instancePath+"/combination_rules/" + i6+"/window/lookback_periods",schemaPath:"#/$defs/window/properties/lookback_periods/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err135];
}
else {
vErrors.push(err135);
}
errors++;
}
}
}
if(data66.anchor !== undefined){
if("service_date" !== data66.anchor){
const err136 = {instancePath:instancePath+"/combination_rules/" + i6+"/window/anchor",schemaPath:"#/$defs/window/properties/anchor/const",keyword:"const",params:{allowedValue: "service_date"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err136];
}
else {
vErrors.push(err136);
}
errors++;
}
}
}
else {
const err137 = {instancePath:instancePath+"/combination_rules/" + i6+"/window",schemaPath:"#/$defs/window/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err137];
}
else {
vErrors.push(err137);
}
errors++;
}
}
if(data62.reason !== undefined){
let data70 = data62.reason;
if(typeof data70 === "string"){
if(func1(data70) < 1){
const err138 = {instancePath:instancePath+"/combination_rules/" + i6+"/reason",schemaPath:"#/properties/combination_rules/items/properties/reason/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err138];
}
else {
vErrors.push(err138);
}
errors++;
}
}
else {
const err139 = {instancePath:instancePath+"/combination_rules/" + i6+"/reason",schemaPath:"#/properties/combination_rules/items/properties/reason/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err139];
}
else {
vErrors.push(err139);
}
errors++;
}
}
if(data62.source_ids !== undefined){
let data71 = data62.source_ids;
if(Array.isArray(data71)){
if(data71.length < 1){
const err140 = {instancePath:instancePath+"/combination_rules/" + i6+"/source_ids",schemaPath:"#/$defs/source_ids/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"};
if(vErrors === null){
vErrors = [err140];
}
else {
vErrors.push(err140);
}
errors++;
}
const len7 = data71.length;
for(let i9=0; i9<len7; i9++){
let data72 = data71[i9];
if(typeof data72 === "string"){
if(func1(data72) < 1){
const err141 = {instancePath:instancePath+"/combination_rules/" + i6+"/source_ids/" + i9,schemaPath:"#/$defs/source_ids/items/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err141];
}
else {
vErrors.push(err141);
}
errors++;
}
}
else {
const err142 = {instancePath:instancePath+"/combination_rules/" + i6+"/source_ids/" + i9,schemaPath:"#/$defs/source_ids/items/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err142];
}
else {
vErrors.push(err142);
}
errors++;
}
}
let i10 = data71.length;
let j2;
if(i10 > 1){
const indices2 = {};
for(;i10--;){
let item2 = data71[i10];
if(typeof item2 !== "string"){
continue;
}
if(typeof indices2[item2] == "number"){
j2 = indices2[item2];
const err143 = {instancePath:instancePath+"/combination_rules/" + i6+"/source_ids",schemaPath:"#/$defs/source_ids/uniqueItems",keyword:"uniqueItems",params:{i: i10, j: j2},message:"must NOT have duplicate items (items ## "+j2+" and "+i10+" are identical)"};
if(vErrors === null){
vErrors = [err143];
}
else {
vErrors.push(err143);
}
errors++;
break;
}
indices2[item2] = i10;
}
}
}
else {
const err144 = {instancePath:instancePath+"/combination_rules/" + i6+"/source_ids",schemaPath:"#/$defs/source_ids/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err144];
}
else {
vErrors.push(err144);
}
errors++;
}
}
}
else {
const err145 = {instancePath:instancePath+"/combination_rules/" + i6,schemaPath:"#/properties/combination_rules/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err145];
}
else {
vErrors.push(err145);
}
errors++;
}
}
}
else {
const err146 = {instancePath:instancePath+"/combination_rules",schemaPath:"#/properties/combination_rules/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err146];
}
else {
vErrors.push(err146);
}
errors++;
}
}
if(data.frequency_limits !== undefined){
let data73 = data.frequency_limits;
if(Array.isArray(data73)){
const len8 = data73.length;
for(let i11=0; i11<len8; i11++){
let data74 = data73[i11];
if(data74 && typeof data74 == "object" && !Array.isArray(data74)){
if(data74.max_count === undefined){
const err147 = {instancePath:instancePath+"/frequency_limits/" + i11,schemaPath:"#/properties/frequency_limits/items/required",keyword:"required",params:{missingProperty: "max_count"},message:"must have required property '"+"max_count"+"'"};
if(vErrors === null){
vErrors = [err147];
}
else {
vErrors.push(err147);
}
errors++;
}
if(data74.count_codes === undefined){
const err148 = {instancePath:instancePath+"/frequency_limits/" + i11,schemaPath:"#/properties/frequency_limits/items/required",keyword:"required",params:{missingProperty: "count_codes"},message:"must have required property '"+"count_codes"+"'"};
if(vErrors === null){
vErrors = [err148];
}
else {
vErrors.push(err148);
}
errors++;
}
if(data74.window === undefined){
const err149 = {instancePath:instancePath+"/frequency_limits/" + i11,schemaPath:"#/properties/frequency_limits/items/required",keyword:"required",params:{missingProperty: "window"},message:"must have required property '"+"window"+"'"};
if(vErrors === null){
vErrors = [err149];
}
else {
vErrors.push(err149);
}
errors++;
}
if(data74.source_ids === undefined){
const err150 = {instancePath:instancePath+"/frequency_limits/" + i11,schemaPath:"#/properties/frequency_limits/items/required",keyword:"required",params:{missingProperty: "source_ids"},message:"must have required property '"+"source_ids"+"'"};
if(vErrors === null){
vErrors = [err150];
}
else {
vErrors.push(err150);
}
errors++;
}
for(const key8 in data74){
if(!((((key8 === "max_count") || (key8 === "count_codes")) || (key8 === "window")) || (key8 === "source_ids"))){
const err151 = {instancePath:instancePath+"/frequency_limits/" + i11,schemaPath:"#/properties/frequency_limits/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key8},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err151];
}
else {
vErrors.push(err151);
}
errors++;
}
}
if(data74.max_count !== undefined){
let data75 = data74.max_count;
if(!(((typeof data75 == "number") && (!(data75 % 1) && !isNaN(data75))) && (isFinite(data75)))){
const err152 = {instancePath:instancePath+"/frequency_limits/" + i11+"/max_count",schemaPath:"#/properties/frequency_limits/items/properties/max_count/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err152];
}
else {
vErrors.push(err152);
}
errors++;
}
if((typeof data75 == "number") && (isFinite(data75))){
if(data75 < 1 || isNaN(data75)){
const err153 = {instancePath:instancePath+"/frequency_limits/" + i11+"/max_count",schemaPath:"#/properties/frequency_limits/items/properties/max_count/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};
if(vErrors === null){
vErrors = [err153];
}
else {
vErrors.push(err153);
}
errors++;
}
}
}
if(data74.count_codes !== undefined){
let data76 = data74.count_codes;
if(Array.isArray(data76)){
const len9 = data76.length;
for(let i12=0; i12<len9; i12++){
let data77 = data76[i12];
if(typeof data77 === "string"){
if(func1(data77) < 1){
const err154 = {instancePath:instancePath+"/frequency_limits/" + i11+"/count_codes/" + i12,schemaPath:"#/$defs/codes/items/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err154];
}
else {
vErrors.push(err154);
}
errors++;
}
}
else {
const err155 = {instancePath:instancePath+"/frequency_limits/" + i11+"/count_codes/" + i12,schemaPath:"#/$defs/codes/items/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err155];
}
else {
vErrors.push(err155);
}
errors++;
}
}
let i13 = data76.length;
let j3;
if(i13 > 1){
const indices3 = {};
for(;i13--;){
let item3 = data76[i13];
if(typeof item3 !== "string"){
continue;
}
if(typeof indices3[item3] == "number"){
j3 = indices3[item3];
const err156 = {instancePath:instancePath+"/frequency_limits/" + i11+"/count_codes",schemaPath:"#/$defs/codes/uniqueItems",keyword:"uniqueItems",params:{i: i13, j: j3},message:"must NOT have duplicate items (items ## "+j3+" and "+i13+" are identical)"};
if(vErrors === null){
vErrors = [err156];
}
else {
vErrors.push(err156);
}
errors++;
break;
}
indices3[item3] = i13;
}
}
}
else {
const err157 = {instancePath:instancePath+"/frequency_limits/" + i11+"/count_codes",schemaPath:"#/$defs/codes/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err157];
}
else {
vErrors.push(err157);
}
errors++;
}
if(Array.isArray(data76)){
if(data76.length < 1){
const err158 = {instancePath:instancePath+"/frequency_limits/" + i11+"/count_codes",schemaPath:"#/properties/frequency_limits/items/properties/count_codes/allOf/1/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"};
if(vErrors === null){
vErrors = [err158];
}
else {
vErrors.push(err158);
}
errors++;
}
}
}
if(data74.window !== undefined){
let data78 = data74.window;
if(data78 && typeof data78 == "object" && !Array.isArray(data78)){
if(data78.unit === undefined){
const err159 = {instancePath:instancePath+"/frequency_limits/" + i11+"/window",schemaPath:"#/$defs/window/required",keyword:"required",params:{missingProperty: "unit"},message:"must have required property '"+"unit"+"'"};
if(vErrors === null){
vErrors = [err159];
}
else {
vErrors.push(err159);
}
errors++;
}
if(data78.lookback_periods === undefined){
const err160 = {instancePath:instancePath+"/frequency_limits/" + i11+"/window",schemaPath:"#/$defs/window/required",keyword:"required",params:{missingProperty: "lookback_periods"},message:"must have required property '"+"lookback_periods"+"'"};
if(vErrors === null){
vErrors = [err160];
}
else {
vErrors.push(err160);
}
errors++;
}
if(data78.anchor === undefined){
const err161 = {instancePath:instancePath+"/frequency_limits/" + i11+"/window",schemaPath:"#/$defs/window/required",keyword:"required",params:{missingProperty: "anchor"},message:"must have required property '"+"anchor"+"'"};
if(vErrors === null){
vErrors = [err161];
}
else {
vErrors.push(err161);
}
errors++;
}
for(const key9 in data78){
if(!(((key9 === "unit") || (key9 === "lookback_periods")) || (key9 === "anchor"))){
const err162 = {instancePath:instancePath+"/frequency_limits/" + i11+"/window",schemaPath:"#/$defs/window/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key9},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err162];
}
else {
vErrors.push(err162);
}
errors++;
}
}
if(data78.unit !== undefined){
let data79 = data78.unit;
if(!(((((data79 === "visit") || (data79 === "day")) || (data79 === "treatment_case")) || (data79 === "quarter")) || (data79 === "year"))){
const err163 = {instancePath:instancePath+"/frequency_limits/" + i11+"/window/unit",schemaPath:"#/$defs/window/properties/unit/enum",keyword:"enum",params:{allowedValues: schema39.properties.unit.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err163];
}
else {
vErrors.push(err163);
}
errors++;
}
}
if(data78.lookback_periods !== undefined){
let data80 = data78.lookback_periods;
if(!(((typeof data80 == "number") && (!(data80 % 1) && !isNaN(data80))) && (isFinite(data80)))){
const err164 = {instancePath:instancePath+"/frequency_limits/" + i11+"/window/lookback_periods",schemaPath:"#/$defs/window/properties/lookback_periods/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err164];
}
else {
vErrors.push(err164);
}
errors++;
}
if((typeof data80 == "number") && (isFinite(data80))){
if(data80 < 0 || isNaN(data80)){
const err165 = {instancePath:instancePath+"/frequency_limits/" + i11+"/window/lookback_periods",schemaPath:"#/$defs/window/properties/lookback_periods/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err165];
}
else {
vErrors.push(err165);
}
errors++;
}
}
}
if(data78.anchor !== undefined){
if("service_date" !== data78.anchor){
const err166 = {instancePath:instancePath+"/frequency_limits/" + i11+"/window/anchor",schemaPath:"#/$defs/window/properties/anchor/const",keyword:"const",params:{allowedValue: "service_date"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err166];
}
else {
vErrors.push(err166);
}
errors++;
}
}
}
else {
const err167 = {instancePath:instancePath+"/frequency_limits/" + i11+"/window",schemaPath:"#/$defs/window/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err167];
}
else {
vErrors.push(err167);
}
errors++;
}
}
if(data74.source_ids !== undefined){
let data82 = data74.source_ids;
if(Array.isArray(data82)){
if(data82.length < 1){
const err168 = {instancePath:instancePath+"/frequency_limits/" + i11+"/source_ids",schemaPath:"#/$defs/source_ids/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"};
if(vErrors === null){
vErrors = [err168];
}
else {
vErrors.push(err168);
}
errors++;
}
const len10 = data82.length;
for(let i14=0; i14<len10; i14++){
let data83 = data82[i14];
if(typeof data83 === "string"){
if(func1(data83) < 1){
const err169 = {instancePath:instancePath+"/frequency_limits/" + i11+"/source_ids/" + i14,schemaPath:"#/$defs/source_ids/items/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err169];
}
else {
vErrors.push(err169);
}
errors++;
}
}
else {
const err170 = {instancePath:instancePath+"/frequency_limits/" + i11+"/source_ids/" + i14,schemaPath:"#/$defs/source_ids/items/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err170];
}
else {
vErrors.push(err170);
}
errors++;
}
}
let i15 = data82.length;
let j4;
if(i15 > 1){
const indices4 = {};
for(;i15--;){
let item4 = data82[i15];
if(typeof item4 !== "string"){
continue;
}
if(typeof indices4[item4] == "number"){
j4 = indices4[item4];
const err171 = {instancePath:instancePath+"/frequency_limits/" + i11+"/source_ids",schemaPath:"#/$defs/source_ids/uniqueItems",keyword:"uniqueItems",params:{i: i15, j: j4},message:"must NOT have duplicate items (items ## "+j4+" and "+i15+" are identical)"};
if(vErrors === null){
vErrors = [err171];
}
else {
vErrors.push(err171);
}
errors++;
break;
}
indices4[item4] = i15;
}
}
}
else {
const err172 = {instancePath:instancePath+"/frequency_limits/" + i11+"/source_ids",schemaPath:"#/$defs/source_ids/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err172];
}
else {
vErrors.push(err172);
}
errors++;
}
}
}
else {
const err173 = {instancePath:instancePath+"/frequency_limits/" + i11,schemaPath:"#/properties/frequency_limits/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err173];
}
else {
vErrors.push(err173);
}
errors++;
}
}
}
else {
const err174 = {instancePath:instancePath+"/frequency_limits",schemaPath:"#/properties/frequency_limits/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err174];
}
else {
vErrors.push(err174);
}
errors++;
}
}
if(data.result !== undefined){
let data84 = data.result;
if(data84 && typeof data84 == "object" && !Array.isArray(data84)){
if(data84.type === undefined){
const err175 = {instancePath:instancePath+"/result",schemaPath:"#/properties/result/required",keyword:"required",params:{missingProperty: "type"},message:"must have required property '"+"type"+"'"};
if(vErrors === null){
vErrors = [err175];
}
else {
vErrors.push(err175);
}
errors++;
}
if(data84.explanation === undefined){
const err176 = {instancePath:instancePath+"/result",schemaPath:"#/properties/result/required",keyword:"required",params:{missingProperty: "explanation"},message:"must have required property '"+"explanation"+"'"};
if(vErrors === null){
vErrors = [err176];
}
else {
vErrors.push(err176);
}
errors++;
}
if(data84.missing_evidence_message === undefined){
const err177 = {instancePath:instancePath+"/result",schemaPath:"#/properties/result/required",keyword:"required",params:{missingProperty: "missing_evidence_message"},message:"must have required property '"+"missing_evidence_message"+"'"};
if(vErrors === null){
vErrors = [err177];
}
else {
vErrors.push(err177);
}
errors++;
}
if(data84.requires_human_confirmation === undefined){
const err178 = {instancePath:instancePath+"/result",schemaPath:"#/properties/result/required",keyword:"required",params:{missingProperty: "requires_human_confirmation"},message:"must have required property '"+"requires_human_confirmation"+"'"};
if(vErrors === null){
vErrors = [err178];
}
else {
vErrors.push(err178);
}
errors++;
}
for(const key10 in data84){
if(!((((key10 === "type") || (key10 === "explanation")) || (key10 === "missing_evidence_message")) || (key10 === "requires_human_confirmation"))){
const err179 = {instancePath:instancePath+"/result",schemaPath:"#/properties/result/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key10},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err179];
}
else {
vErrors.push(err179);
}
errors++;
}
}
if(data84.type !== undefined){
let data85 = data84.type;
if(!((((data85 === "possible_missing_code") || (data85 === "documentation_incomplete")) || (data85 === "coding_missing")) || (data85 === "billing_conflict"))){
const err180 = {instancePath:instancePath+"/result/type",schemaPath:"#/properties/result/properties/type/enum",keyword:"enum",params:{allowedValues: schema32.properties.result.properties.type.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err180];
}
else {
vErrors.push(err180);
}
errors++;
}
}
if(data84.explanation !== undefined){
let data86 = data84.explanation;
if(typeof data86 === "string"){
if(func1(data86) < 1){
const err181 = {instancePath:instancePath+"/result/explanation",schemaPath:"#/properties/result/properties/explanation/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err181];
}
else {
vErrors.push(err181);
}
errors++;
}
}
else {
const err182 = {instancePath:instancePath+"/result/explanation",schemaPath:"#/properties/result/properties/explanation/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err182];
}
else {
vErrors.push(err182);
}
errors++;
}
}
if(data84.missing_evidence_message !== undefined){
let data87 = data84.missing_evidence_message;
if(typeof data87 === "string"){
if(func1(data87) < 1){
const err183 = {instancePath:instancePath+"/result/missing_evidence_message",schemaPath:"#/properties/result/properties/missing_evidence_message/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err183];
}
else {
vErrors.push(err183);
}
errors++;
}
}
else {
const err184 = {instancePath:instancePath+"/result/missing_evidence_message",schemaPath:"#/properties/result/properties/missing_evidence_message/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err184];
}
else {
vErrors.push(err184);
}
errors++;
}
}
if(data84.requires_human_confirmation !== undefined){
if(true !== data84.requires_human_confirmation){
const err185 = {instancePath:instancePath+"/result/requires_human_confirmation",schemaPath:"#/properties/result/properties/requires_human_confirmation/const",keyword:"const",params:{allowedValue: true},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err185];
}
else {
vErrors.push(err185);
}
errors++;
}
}
}
else {
const err186 = {instancePath:instancePath+"/result",schemaPath:"#/properties/result/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err186];
}
else {
vErrors.push(err186);
}
errors++;
}
}
}
else {
const err187 = {instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err187];
}
else {
vErrors.push(err187);
}
errors++;
}
validate21.errors = vErrors;
return errors === 0;
}
validate21.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};


function validate20(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
/*# sourceURL="urn:praxis-assistent:schema:billing-rule-package:0.1.0" */;
let vErrors = null;
let errors = 0;
const evaluated0 = validate20.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
const _errs2 = errors;
let valid1 = true;
const _errs3 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.content_kind !== undefined){
if("synthetic_example" !== data.content_kind){
const err0 = {};
if(vErrors === null){
vErrors = [err0];
}
else {
vErrors.push(err0);
}
errors++;
}
}
}
var _valid0 = _errs3 === errors;
errors = _errs2;
if(vErrors !== null){
if(_errs2){
vErrors.length = _errs2;
}
else {
vErrors = null;
}
}
if(_valid0){
const _errs5 = errors;
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.rules !== undefined){
let data1 = data.rules;
if(Array.isArray(data1)){
const len0 = data1.length;
for(let i0=0; i0<len0; i0++){
let data2 = data1[i0];
if(data2 && typeof data2 == "object" && !Array.isArray(data2)){
if(data2.id !== undefined){
let data3 = data2.id;
if(typeof data3 === "string"){
if(!pattern4.test(data3)){
const err1 = {instancePath:instancePath+"/rules/" + i0+"/id",schemaPath:"#/allOf/0/then/properties/rules/items/properties/id/pattern",keyword:"pattern",params:{pattern: "^DEMO_"},message:"must match pattern \""+"^DEMO_"+"\""};
if(vErrors === null){
vErrors = [err1];
}
else {
vErrors.push(err1);
}
errors++;
}
}
}
if(data2.billing_system !== undefined){
if("DEMO" !== data2.billing_system){
const err2 = {instancePath:instancePath+"/rules/" + i0+"/billing_system",schemaPath:"#/allOf/0/then/properties/rules/items/properties/billing_system/const",keyword:"const",params:{allowedValue: "DEMO"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err2];
}
else {
vErrors.push(err2);
}
errors++;
}
}
if(data2.status !== undefined){
if("draft" !== data2.status){
const err3 = {instancePath:instancePath+"/rules/" + i0+"/status",schemaPath:"#/allOf/0/then/properties/rules/items/properties/status/const",keyword:"const",params:{allowedValue: "draft"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err3];
}
else {
vErrors.push(err3);
}
errors++;
}
}
if(data2.procedure_codes !== undefined){
let data6 = data2.procedure_codes;
if(Array.isArray(data6)){
const len1 = data6.length;
for(let i1=0; i1<len1; i1++){
let data7 = data6[i1];
if(typeof data7 === "string"){
if(!pattern4.test(data7)){
const err4 = {instancePath:instancePath+"/rules/" + i0+"/procedure_codes/" + i1,schemaPath:"#/allOf/0/then/properties/rules/items/properties/procedure_codes/items/pattern",keyword:"pattern",params:{pattern: "^DEMO_"},message:"must match pattern \""+"^DEMO_"+"\""};
if(vErrors === null){
vErrors = [err4];
}
else {
vErrors.push(err4);
}
errors++;
}
}
}
}
}
if(data2.sources !== undefined){
let data8 = data2.sources;
if(Array.isArray(data8)){
const len2 = data8.length;
for(let i2=0; i2<len2; i2++){
let data9 = data8[i2];
if(data9 && typeof data9 == "object" && !Array.isArray(data9)){
if(data9.kind !== undefined){
if("synthetic" !== data9.kind){
const err5 = {instancePath:instancePath+"/rules/" + i0+"/sources/" + i2+"/kind",schemaPath:"#/allOf/0/then/properties/rules/items/properties/sources/items/properties/kind/const",keyword:"const",params:{allowedValue: "synthetic"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err5];
}
else {
vErrors.push(err5);
}
errors++;
}
}
}
}
}
}
}
}
}
}
}
var _valid0 = _errs5 === errors;
valid1 = _valid0;
if(valid1){
var props0 = {};
props0.rules = true;
props0.content_kind = true;
}
}
if(!valid1){
const err6 = {instancePath,schemaPath:"#/allOf/0/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err6];
}
else {
vErrors.push(err6);
}
errors++;
}
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.schema_version === undefined){
const err7 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "schema_version"},message:"must have required property '"+"schema_version"+"'"};
if(vErrors === null){
vErrors = [err7];
}
else {
vErrors.push(err7);
}
errors++;
}
if(data.package_id === undefined){
const err8 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "package_id"},message:"must have required property '"+"package_id"+"'"};
if(vErrors === null){
vErrors = [err8];
}
else {
vErrors.push(err8);
}
errors++;
}
if(data.package_version === undefined){
const err9 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "package_version"},message:"must have required property '"+"package_version"+"'"};
if(vErrors === null){
vErrors = [err9];
}
else {
vErrors.push(err9);
}
errors++;
}
if(data.content_kind === undefined){
const err10 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "content_kind"},message:"must have required property '"+"content_kind"+"'"};
if(vErrors === null){
vErrors = [err10];
}
else {
vErrors.push(err10);
}
errors++;
}
if(data.rules === undefined){
const err11 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "rules"},message:"must have required property '"+"rules"+"'"};
if(vErrors === null){
vErrors = [err11];
}
else {
vErrors.push(err11);
}
errors++;
}
for(const key0 in data){
if(!(((((key0 === "schema_version") || (key0 === "package_id")) || (key0 === "package_version")) || (key0 === "content_kind")) || (key0 === "rules"))){
const err12 = {instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err12];
}
else {
vErrors.push(err12);
}
errors++;
}
}
if(data.schema_version !== undefined){
if("0.1.0" !== data.schema_version){
const err13 = {instancePath:instancePath+"/schema_version",schemaPath:"#/properties/schema_version/const",keyword:"const",params:{allowedValue: "0.1.0"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err13];
}
else {
vErrors.push(err13);
}
errors++;
}
}
if(data.package_id !== undefined){
let data12 = data.package_id;
if(typeof data12 === "string"){
if(func1(data12) < 1){
const err14 = {instancePath:instancePath+"/package_id",schemaPath:"#/properties/package_id/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err14];
}
else {
vErrors.push(err14);
}
errors++;
}
}
else {
const err15 = {instancePath:instancePath+"/package_id",schemaPath:"#/properties/package_id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err15];
}
else {
vErrors.push(err15);
}
errors++;
}
}
if(data.package_version !== undefined){
let data13 = data.package_version;
if(typeof data13 === "string"){
if(func1(data13) < 1){
const err16 = {instancePath:instancePath+"/package_version",schemaPath:"#/properties/package_version/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err16];
}
else {
vErrors.push(err16);
}
errors++;
}
}
else {
const err17 = {instancePath:instancePath+"/package_version",schemaPath:"#/properties/package_version/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err17];
}
else {
vErrors.push(err17);
}
errors++;
}
}
if(data.content_kind !== undefined){
let data14 = data.content_kind;
if(!((data14 === "synthetic_example") || (data14 === "reviewed_catalogue"))){
const err18 = {instancePath:instancePath+"/content_kind",schemaPath:"#/properties/content_kind/enum",keyword:"enum",params:{allowedValues: schema31.properties.content_kind.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err18];
}
else {
vErrors.push(err18);
}
errors++;
}
}
if(data.rules !== undefined){
let data15 = data.rules;
if(Array.isArray(data15)){
if(data15.length < 1){
const err19 = {instancePath:instancePath+"/rules",schemaPath:"#/properties/rules/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"};
if(vErrors === null){
vErrors = [err19];
}
else {
vErrors.push(err19);
}
errors++;
}
const len3 = data15.length;
for(let i3=0; i3<len3; i3++){
if(!(validate21(data15[i3], {instancePath:instancePath+"/rules/" + i3,parentData:data15,parentDataProperty:i3,rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate21.errors : vErrors.concat(validate21.errors);
errors = vErrors.length;
}
}
}
else {
const err20 = {instancePath:instancePath+"/rules",schemaPath:"#/properties/rules/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err20];
}
else {
vErrors.push(err20);
}
errors++;
}
}
}
else {
const err21 = {instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err21];
}
else {
vErrors.push(err21);
}
errors++;
}
validate20.errors = vErrors;
return errors === 0;
}
validate20.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};

export const settings = validate27;
const schema48 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"urn:praxis-assistent:schema:practice-settings:0.1.0","title":"Praxisassistenz non-patient settings","type":"object","additionalProperties":false,"required":["schema_version","region","available_billing_systems","hzv","analysis","safety"],"properties":{"schema_version":{"const":"0.1.0"},"region":{"type":"object","additionalProperties":false,"required":["country","bundesland","kv"],"properties":{"country":{"const":"DE"},"bundesland":{"const":"NRW"},"kv":{"enum":[null,"Nordrhein","Westfalen-Lippe"]}}},"available_billing_systems":{"type":"array","minItems":1,"uniqueItems":true,"items":{"enum":["EBM","GOAE"]}},"hzv":{"type":"object","additionalProperties":false,"required":["enabled","contracts"],"properties":{"enabled":{"type":"boolean"},"contracts":{"type":"array","items":{"$ref":"#/$defs/hzv_contract"}}}},"analysis":{"type":"object","additionalProperties":false,"required":["default_scope","unknown_condition_policy","date_basis"],"properties":{"default_scope":{"enum":["selected_date","date_range","quarter","whole_record"]},"unknown_condition_policy":{"const":"not_verifiable"},"date_basis":{"const":"service_date"}}},"safety":{"type":"object","additionalProperties":false,"required":["auto_submit_billing","auto_write_to_duria","require_patient_context_recheck","allow_patient_data_in_project_files"],"properties":{"auto_submit_billing":{"const":false},"auto_write_to_duria":{"const":false},"require_patient_context_recheck":{"const":true},"allow_patient_data_in_project_files":{"const":false}}}},"$defs":{"hzv_contract":{"type":"object","additionalProperties":false,"required":["contract_id","name","version","kv","insurer_ids","valid_from","valid_to","source_uri","terms_review_status","practice_participation"],"properties":{"contract_id":{"type":"string","minLength":1},"name":{"type":"string","minLength":1},"version":{"type":"string","minLength":1},"kv":{"enum":["Nordrhein","Westfalen-Lippe"]},"insurer_ids":{"type":"array","minItems":1,"uniqueItems":true,"items":{"type":"string","minLength":1}},"valid_from":{"type":"string","format":"date"},"valid_to":{"type":["string","null"],"format":"date"},"source_uri":{"type":"string","format":"uri"},"terms_review_status":{"enum":["pending","approved","rejected"]},"practice_participation":{"type":"object","additionalProperties":false,"required":["status","valid_from","valid_to","evidence_ref"],"properties":{"status":{"enum":["unknown","confirmed","not_participating"]},"valid_from":{"type":["string","null"],"format":"date"},"valid_to":{"type":["string","null"],"format":"date"},"evidence_ref":{"type":["string","null"]}},"allOf":[{"if":{"properties":{"status":{"const":"confirmed"}}},"then":{"properties":{"valid_from":{"type":"string","format":"date"},"evidence_ref":{"type":"string","minLength":1}}}}]}}}}};
const schema49 = {"type":"object","additionalProperties":false,"required":["contract_id","name","version","kv","insurer_ids","valid_from","valid_to","source_uri","terms_review_status","practice_participation"],"properties":{"contract_id":{"type":"string","minLength":1},"name":{"type":"string","minLength":1},"version":{"type":"string","minLength":1},"kv":{"enum":["Nordrhein","Westfalen-Lippe"]},"insurer_ids":{"type":"array","minItems":1,"uniqueItems":true,"items":{"type":"string","minLength":1}},"valid_from":{"type":"string","format":"date"},"valid_to":{"type":["string","null"],"format":"date"},"source_uri":{"type":"string","format":"uri"},"terms_review_status":{"enum":["pending","approved","rejected"]},"practice_participation":{"type":"object","additionalProperties":false,"required":["status","valid_from","valid_to","evidence_ref"],"properties":{"status":{"enum":["unknown","confirmed","not_participating"]},"valid_from":{"type":["string","null"],"format":"date"},"valid_to":{"type":["string","null"],"format":"date"},"evidence_ref":{"type":["string","null"]}},"allOf":[{"if":{"properties":{"status":{"const":"confirmed"}}},"then":{"properties":{"valid_from":{"type":"string","format":"date"},"evidence_ref":{"type":"string","minLength":1}}}}]}}};
const func0 = typeof __m1.default === 'function' ? __m1.default : __m1.default.default;

function validate27(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
/*# sourceURL="urn:praxis-assistent:schema:practice-settings:0.1.0" */;
let vErrors = null;
let errors = 0;
const evaluated0 = validate27.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.schema_version === undefined){
const err0 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "schema_version"},message:"must have required property '"+"schema_version"+"'"};
if(vErrors === null){
vErrors = [err0];
}
else {
vErrors.push(err0);
}
errors++;
}
if(data.region === undefined){
const err1 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "region"},message:"must have required property '"+"region"+"'"};
if(vErrors === null){
vErrors = [err1];
}
else {
vErrors.push(err1);
}
errors++;
}
if(data.available_billing_systems === undefined){
const err2 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "available_billing_systems"},message:"must have required property '"+"available_billing_systems"+"'"};
if(vErrors === null){
vErrors = [err2];
}
else {
vErrors.push(err2);
}
errors++;
}
if(data.hzv === undefined){
const err3 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "hzv"},message:"must have required property '"+"hzv"+"'"};
if(vErrors === null){
vErrors = [err3];
}
else {
vErrors.push(err3);
}
errors++;
}
if(data.analysis === undefined){
const err4 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "analysis"},message:"must have required property '"+"analysis"+"'"};
if(vErrors === null){
vErrors = [err4];
}
else {
vErrors.push(err4);
}
errors++;
}
if(data.safety === undefined){
const err5 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "safety"},message:"must have required property '"+"safety"+"'"};
if(vErrors === null){
vErrors = [err5];
}
else {
vErrors.push(err5);
}
errors++;
}
for(const key0 in data){
if(!((((((key0 === "schema_version") || (key0 === "region")) || (key0 === "available_billing_systems")) || (key0 === "hzv")) || (key0 === "analysis")) || (key0 === "safety"))){
const err6 = {instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err6];
}
else {
vErrors.push(err6);
}
errors++;
}
}
if(data.schema_version !== undefined){
if("0.1.0" !== data.schema_version){
const err7 = {instancePath:instancePath+"/schema_version",schemaPath:"#/properties/schema_version/const",keyword:"const",params:{allowedValue: "0.1.0"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err7];
}
else {
vErrors.push(err7);
}
errors++;
}
}
if(data.region !== undefined){
let data1 = data.region;
if(data1 && typeof data1 == "object" && !Array.isArray(data1)){
if(data1.country === undefined){
const err8 = {instancePath:instancePath+"/region",schemaPath:"#/properties/region/required",keyword:"required",params:{missingProperty: "country"},message:"must have required property '"+"country"+"'"};
if(vErrors === null){
vErrors = [err8];
}
else {
vErrors.push(err8);
}
errors++;
}
if(data1.bundesland === undefined){
const err9 = {instancePath:instancePath+"/region",schemaPath:"#/properties/region/required",keyword:"required",params:{missingProperty: "bundesland"},message:"must have required property '"+"bundesland"+"'"};
if(vErrors === null){
vErrors = [err9];
}
else {
vErrors.push(err9);
}
errors++;
}
if(data1.kv === undefined){
const err10 = {instancePath:instancePath+"/region",schemaPath:"#/properties/region/required",keyword:"required",params:{missingProperty: "kv"},message:"must have required property '"+"kv"+"'"};
if(vErrors === null){
vErrors = [err10];
}
else {
vErrors.push(err10);
}
errors++;
}
for(const key1 in data1){
if(!(((key1 === "country") || (key1 === "bundesland")) || (key1 === "kv"))){
const err11 = {instancePath:instancePath+"/region",schemaPath:"#/properties/region/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err11];
}
else {
vErrors.push(err11);
}
errors++;
}
}
if(data1.country !== undefined){
if("DE" !== data1.country){
const err12 = {instancePath:instancePath+"/region/country",schemaPath:"#/properties/region/properties/country/const",keyword:"const",params:{allowedValue: "DE"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err12];
}
else {
vErrors.push(err12);
}
errors++;
}
}
if(data1.bundesland !== undefined){
if("NRW" !== data1.bundesland){
const err13 = {instancePath:instancePath+"/region/bundesland",schemaPath:"#/properties/region/properties/bundesland/const",keyword:"const",params:{allowedValue: "NRW"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err13];
}
else {
vErrors.push(err13);
}
errors++;
}
}
if(data1.kv !== undefined){
let data4 = data1.kv;
if(!(((data4 === null) || (data4 === "Nordrhein")) || (data4 === "Westfalen-Lippe"))){
const err14 = {instancePath:instancePath+"/region/kv",schemaPath:"#/properties/region/properties/kv/enum",keyword:"enum",params:{allowedValues: schema48.properties.region.properties.kv.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err14];
}
else {
vErrors.push(err14);
}
errors++;
}
}
}
else {
const err15 = {instancePath:instancePath+"/region",schemaPath:"#/properties/region/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err15];
}
else {
vErrors.push(err15);
}
errors++;
}
}
if(data.available_billing_systems !== undefined){
let data5 = data.available_billing_systems;
if(Array.isArray(data5)){
if(data5.length < 1){
const err16 = {instancePath:instancePath+"/available_billing_systems",schemaPath:"#/properties/available_billing_systems/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"};
if(vErrors === null){
vErrors = [err16];
}
else {
vErrors.push(err16);
}
errors++;
}
const len0 = data5.length;
for(let i0=0; i0<len0; i0++){
let data6 = data5[i0];
if(!((data6 === "EBM") || (data6 === "GOAE"))){
const err17 = {instancePath:instancePath+"/available_billing_systems/" + i0,schemaPath:"#/properties/available_billing_systems/items/enum",keyword:"enum",params:{allowedValues: schema48.properties.available_billing_systems.items.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err17];
}
else {
vErrors.push(err17);
}
errors++;
}
}
let i1 = data5.length;
let j0;
if(i1 > 1){
outer0:
for(;i1--;){
for(j0 = i1; j0--;){
if(func0(data5[i1], data5[j0])){
const err18 = {instancePath:instancePath+"/available_billing_systems",schemaPath:"#/properties/available_billing_systems/uniqueItems",keyword:"uniqueItems",params:{i: i1, j: j0},message:"must NOT have duplicate items (items ## "+j0+" and "+i1+" are identical)"};
if(vErrors === null){
vErrors = [err18];
}
else {
vErrors.push(err18);
}
errors++;
break outer0;
}
}
}
}
}
else {
const err19 = {instancePath:instancePath+"/available_billing_systems",schemaPath:"#/properties/available_billing_systems/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err19];
}
else {
vErrors.push(err19);
}
errors++;
}
}
if(data.hzv !== undefined){
let data7 = data.hzv;
if(data7 && typeof data7 == "object" && !Array.isArray(data7)){
if(data7.enabled === undefined){
const err20 = {instancePath:instancePath+"/hzv",schemaPath:"#/properties/hzv/required",keyword:"required",params:{missingProperty: "enabled"},message:"must have required property '"+"enabled"+"'"};
if(vErrors === null){
vErrors = [err20];
}
else {
vErrors.push(err20);
}
errors++;
}
if(data7.contracts === undefined){
const err21 = {instancePath:instancePath+"/hzv",schemaPath:"#/properties/hzv/required",keyword:"required",params:{missingProperty: "contracts"},message:"must have required property '"+"contracts"+"'"};
if(vErrors === null){
vErrors = [err21];
}
else {
vErrors.push(err21);
}
errors++;
}
for(const key2 in data7){
if(!((key2 === "enabled") || (key2 === "contracts"))){
const err22 = {instancePath:instancePath+"/hzv",schemaPath:"#/properties/hzv/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key2},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err22];
}
else {
vErrors.push(err22);
}
errors++;
}
}
if(data7.enabled !== undefined){
if(typeof data7.enabled !== "boolean"){
const err23 = {instancePath:instancePath+"/hzv/enabled",schemaPath:"#/properties/hzv/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};
if(vErrors === null){
vErrors = [err23];
}
else {
vErrors.push(err23);
}
errors++;
}
}
if(data7.contracts !== undefined){
let data9 = data7.contracts;
if(Array.isArray(data9)){
const len1 = data9.length;
for(let i2=0; i2<len1; i2++){
let data10 = data9[i2];
if(data10 && typeof data10 == "object" && !Array.isArray(data10)){
if(data10.contract_id === undefined){
const err24 = {instancePath:instancePath+"/hzv/contracts/" + i2,schemaPath:"#/$defs/hzv_contract/required",keyword:"required",params:{missingProperty: "contract_id"},message:"must have required property '"+"contract_id"+"'"};
if(vErrors === null){
vErrors = [err24];
}
else {
vErrors.push(err24);
}
errors++;
}
if(data10.name === undefined){
const err25 = {instancePath:instancePath+"/hzv/contracts/" + i2,schemaPath:"#/$defs/hzv_contract/required",keyword:"required",params:{missingProperty: "name"},message:"must have required property '"+"name"+"'"};
if(vErrors === null){
vErrors = [err25];
}
else {
vErrors.push(err25);
}
errors++;
}
if(data10.version === undefined){
const err26 = {instancePath:instancePath+"/hzv/contracts/" + i2,schemaPath:"#/$defs/hzv_contract/required",keyword:"required",params:{missingProperty: "version"},message:"must have required property '"+"version"+"'"};
if(vErrors === null){
vErrors = [err26];
}
else {
vErrors.push(err26);
}
errors++;
}
if(data10.kv === undefined){
const err27 = {instancePath:instancePath+"/hzv/contracts/" + i2,schemaPath:"#/$defs/hzv_contract/required",keyword:"required",params:{missingProperty: "kv"},message:"must have required property '"+"kv"+"'"};
if(vErrors === null){
vErrors = [err27];
}
else {
vErrors.push(err27);
}
errors++;
}
if(data10.insurer_ids === undefined){
const err28 = {instancePath:instancePath+"/hzv/contracts/" + i2,schemaPath:"#/$defs/hzv_contract/required",keyword:"required",params:{missingProperty: "insurer_ids"},message:"must have required property '"+"insurer_ids"+"'"};
if(vErrors === null){
vErrors = [err28];
}
else {
vErrors.push(err28);
}
errors++;
}
if(data10.valid_from === undefined){
const err29 = {instancePath:instancePath+"/hzv/contracts/" + i2,schemaPath:"#/$defs/hzv_contract/required",keyword:"required",params:{missingProperty: "valid_from"},message:"must have required property '"+"valid_from"+"'"};
if(vErrors === null){
vErrors = [err29];
}
else {
vErrors.push(err29);
}
errors++;
}
if(data10.valid_to === undefined){
const err30 = {instancePath:instancePath+"/hzv/contracts/" + i2,schemaPath:"#/$defs/hzv_contract/required",keyword:"required",params:{missingProperty: "valid_to"},message:"must have required property '"+"valid_to"+"'"};
if(vErrors === null){
vErrors = [err30];
}
else {
vErrors.push(err30);
}
errors++;
}
if(data10.source_uri === undefined){
const err31 = {instancePath:instancePath+"/hzv/contracts/" + i2,schemaPath:"#/$defs/hzv_contract/required",keyword:"required",params:{missingProperty: "source_uri"},message:"must have required property '"+"source_uri"+"'"};
if(vErrors === null){
vErrors = [err31];
}
else {
vErrors.push(err31);
}
errors++;
}
if(data10.terms_review_status === undefined){
const err32 = {instancePath:instancePath+"/hzv/contracts/" + i2,schemaPath:"#/$defs/hzv_contract/required",keyword:"required",params:{missingProperty: "terms_review_status"},message:"must have required property '"+"terms_review_status"+"'"};
if(vErrors === null){
vErrors = [err32];
}
else {
vErrors.push(err32);
}
errors++;
}
if(data10.practice_participation === undefined){
const err33 = {instancePath:instancePath+"/hzv/contracts/" + i2,schemaPath:"#/$defs/hzv_contract/required",keyword:"required",params:{missingProperty: "practice_participation"},message:"must have required property '"+"practice_participation"+"'"};
if(vErrors === null){
vErrors = [err33];
}
else {
vErrors.push(err33);
}
errors++;
}
for(const key3 in data10){
if(!(func4.call(schema49.properties, key3))){
const err34 = {instancePath:instancePath+"/hzv/contracts/" + i2,schemaPath:"#/$defs/hzv_contract/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key3},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err34];
}
else {
vErrors.push(err34);
}
errors++;
}
}
if(data10.contract_id !== undefined){
let data11 = data10.contract_id;
if(typeof data11 === "string"){
if(func1(data11) < 1){
const err35 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/contract_id",schemaPath:"#/$defs/hzv_contract/properties/contract_id/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err35];
}
else {
vErrors.push(err35);
}
errors++;
}
}
else {
const err36 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/contract_id",schemaPath:"#/$defs/hzv_contract/properties/contract_id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err36];
}
else {
vErrors.push(err36);
}
errors++;
}
}
if(data10.name !== undefined){
let data12 = data10.name;
if(typeof data12 === "string"){
if(func1(data12) < 1){
const err37 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/name",schemaPath:"#/$defs/hzv_contract/properties/name/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err37];
}
else {
vErrors.push(err37);
}
errors++;
}
}
else {
const err38 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/name",schemaPath:"#/$defs/hzv_contract/properties/name/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err38];
}
else {
vErrors.push(err38);
}
errors++;
}
}
if(data10.version !== undefined){
let data13 = data10.version;
if(typeof data13 === "string"){
if(func1(data13) < 1){
const err39 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/version",schemaPath:"#/$defs/hzv_contract/properties/version/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err39];
}
else {
vErrors.push(err39);
}
errors++;
}
}
else {
const err40 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/version",schemaPath:"#/$defs/hzv_contract/properties/version/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err40];
}
else {
vErrors.push(err40);
}
errors++;
}
}
if(data10.kv !== undefined){
let data14 = data10.kv;
if(!((data14 === "Nordrhein") || (data14 === "Westfalen-Lippe"))){
const err41 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/kv",schemaPath:"#/$defs/hzv_contract/properties/kv/enum",keyword:"enum",params:{allowedValues: schema49.properties.kv.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err41];
}
else {
vErrors.push(err41);
}
errors++;
}
}
if(data10.insurer_ids !== undefined){
let data15 = data10.insurer_ids;
if(Array.isArray(data15)){
if(data15.length < 1){
const err42 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/insurer_ids",schemaPath:"#/$defs/hzv_contract/properties/insurer_ids/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"};
if(vErrors === null){
vErrors = [err42];
}
else {
vErrors.push(err42);
}
errors++;
}
const len2 = data15.length;
for(let i3=0; i3<len2; i3++){
let data16 = data15[i3];
if(typeof data16 === "string"){
if(func1(data16) < 1){
const err43 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/insurer_ids/" + i3,schemaPath:"#/$defs/hzv_contract/properties/insurer_ids/items/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err43];
}
else {
vErrors.push(err43);
}
errors++;
}
}
else {
const err44 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/insurer_ids/" + i3,schemaPath:"#/$defs/hzv_contract/properties/insurer_ids/items/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err44];
}
else {
vErrors.push(err44);
}
errors++;
}
}
let i4 = data15.length;
let j1;
if(i4 > 1){
const indices0 = {};
for(;i4--;){
let item0 = data15[i4];
if(typeof item0 !== "string"){
continue;
}
if(typeof indices0[item0] == "number"){
j1 = indices0[item0];
const err45 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/insurer_ids",schemaPath:"#/$defs/hzv_contract/properties/insurer_ids/uniqueItems",keyword:"uniqueItems",params:{i: i4, j: j1},message:"must NOT have duplicate items (items ## "+j1+" and "+i4+" are identical)"};
if(vErrors === null){
vErrors = [err45];
}
else {
vErrors.push(err45);
}
errors++;
break;
}
indices0[item0] = i4;
}
}
}
else {
const err46 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/insurer_ids",schemaPath:"#/$defs/hzv_contract/properties/insurer_ids/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err46];
}
else {
vErrors.push(err46);
}
errors++;
}
}
if(data10.valid_from !== undefined){
let data17 = data10.valid_from;
if(typeof data17 === "string"){
if(!(formats0.validate(data17))){
const err47 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/valid_from",schemaPath:"#/$defs/hzv_contract/properties/valid_from/format",keyword:"format",params:{format: "date"},message:"must match format \""+"date"+"\""};
if(vErrors === null){
vErrors = [err47];
}
else {
vErrors.push(err47);
}
errors++;
}
}
else {
const err48 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/valid_from",schemaPath:"#/$defs/hzv_contract/properties/valid_from/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err48];
}
else {
vErrors.push(err48);
}
errors++;
}
}
if(data10.valid_to !== undefined){
let data18 = data10.valid_to;
if((typeof data18 !== "string") && (data18 !== null)){
const err49 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/valid_to",schemaPath:"#/$defs/hzv_contract/properties/valid_to/type",keyword:"type",params:{type: schema49.properties.valid_to.type},message:"must be string,null"};
if(vErrors === null){
vErrors = [err49];
}
else {
vErrors.push(err49);
}
errors++;
}
if(typeof data18 === "string"){
if(!(formats0.validate(data18))){
const err50 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/valid_to",schemaPath:"#/$defs/hzv_contract/properties/valid_to/format",keyword:"format",params:{format: "date"},message:"must match format \""+"date"+"\""};
if(vErrors === null){
vErrors = [err50];
}
else {
vErrors.push(err50);
}
errors++;
}
}
}
if(data10.source_uri !== undefined){
let data19 = data10.source_uri;
if(typeof data19 === "string"){
if(!(formats4(data19))){
const err51 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/source_uri",schemaPath:"#/$defs/hzv_contract/properties/source_uri/format",keyword:"format",params:{format: "uri"},message:"must match format \""+"uri"+"\""};
if(vErrors === null){
vErrors = [err51];
}
else {
vErrors.push(err51);
}
errors++;
}
}
else {
const err52 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/source_uri",schemaPath:"#/$defs/hzv_contract/properties/source_uri/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err52];
}
else {
vErrors.push(err52);
}
errors++;
}
}
if(data10.terms_review_status !== undefined){
let data20 = data10.terms_review_status;
if(!(((data20 === "pending") || (data20 === "approved")) || (data20 === "rejected"))){
const err53 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/terms_review_status",schemaPath:"#/$defs/hzv_contract/properties/terms_review_status/enum",keyword:"enum",params:{allowedValues: schema49.properties.terms_review_status.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err53];
}
else {
vErrors.push(err53);
}
errors++;
}
}
if(data10.practice_participation !== undefined){
let data21 = data10.practice_participation;
const _errs44 = errors;
let valid14 = true;
const _errs45 = errors;
if(data21 && typeof data21 == "object" && !Array.isArray(data21)){
if(data21.status !== undefined){
if("confirmed" !== data21.status){
const err54 = {};
if(vErrors === null){
vErrors = [err54];
}
else {
vErrors.push(err54);
}
errors++;
}
}
}
var _valid0 = _errs45 === errors;
errors = _errs44;
if(vErrors !== null){
if(_errs44){
vErrors.length = _errs44;
}
else {
vErrors = null;
}
}
if(_valid0){
const _errs47 = errors;
if(data21 && typeof data21 == "object" && !Array.isArray(data21)){
if(data21.valid_from !== undefined){
let data23 = data21.valid_from;
if(typeof data23 === "string"){
if(!(formats0.validate(data23))){
const err55 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/practice_participation/valid_from",schemaPath:"#/$defs/hzv_contract/properties/practice_participation/allOf/0/then/properties/valid_from/format",keyword:"format",params:{format: "date"},message:"must match format \""+"date"+"\""};
if(vErrors === null){
vErrors = [err55];
}
else {
vErrors.push(err55);
}
errors++;
}
}
else {
const err56 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/practice_participation/valid_from",schemaPath:"#/$defs/hzv_contract/properties/practice_participation/allOf/0/then/properties/valid_from/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err56];
}
else {
vErrors.push(err56);
}
errors++;
}
}
if(data21.evidence_ref !== undefined){
let data24 = data21.evidence_ref;
if(typeof data24 === "string"){
if(func1(data24) < 1){
const err57 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/practice_participation/evidence_ref",schemaPath:"#/$defs/hzv_contract/properties/practice_participation/allOf/0/then/properties/evidence_ref/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err57];
}
else {
vErrors.push(err57);
}
errors++;
}
}
else {
const err58 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/practice_participation/evidence_ref",schemaPath:"#/$defs/hzv_contract/properties/practice_participation/allOf/0/then/properties/evidence_ref/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err58];
}
else {
vErrors.push(err58);
}
errors++;
}
}
}
var _valid0 = _errs47 === errors;
valid14 = _valid0;
if(valid14){
var props0 = {};
props0.valid_from = true;
props0.evidence_ref = true;
props0.status = true;
}
}
if(!valid14){
const err59 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/practice_participation",schemaPath:"#/$defs/hzv_contract/properties/practice_participation/allOf/0/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err59];
}
else {
vErrors.push(err59);
}
errors++;
}
if(data21 && typeof data21 == "object" && !Array.isArray(data21)){
if(data21.status === undefined){
const err60 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/practice_participation",schemaPath:"#/$defs/hzv_contract/properties/practice_participation/required",keyword:"required",params:{missingProperty: "status"},message:"must have required property '"+"status"+"'"};
if(vErrors === null){
vErrors = [err60];
}
else {
vErrors.push(err60);
}
errors++;
}
if(data21.valid_from === undefined){
const err61 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/practice_participation",schemaPath:"#/$defs/hzv_contract/properties/practice_participation/required",keyword:"required",params:{missingProperty: "valid_from"},message:"must have required property '"+"valid_from"+"'"};
if(vErrors === null){
vErrors = [err61];
}
else {
vErrors.push(err61);
}
errors++;
}
if(data21.valid_to === undefined){
const err62 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/practice_participation",schemaPath:"#/$defs/hzv_contract/properties/practice_participation/required",keyword:"required",params:{missingProperty: "valid_to"},message:"must have required property '"+"valid_to"+"'"};
if(vErrors === null){
vErrors = [err62];
}
else {
vErrors.push(err62);
}
errors++;
}
if(data21.evidence_ref === undefined){
const err63 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/practice_participation",schemaPath:"#/$defs/hzv_contract/properties/practice_participation/required",keyword:"required",params:{missingProperty: "evidence_ref"},message:"must have required property '"+"evidence_ref"+"'"};
if(vErrors === null){
vErrors = [err63];
}
else {
vErrors.push(err63);
}
errors++;
}
for(const key4 in data21){
if(!((((key4 === "status") || (key4 === "valid_from")) || (key4 === "valid_to")) || (key4 === "evidence_ref"))){
const err64 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/practice_participation",schemaPath:"#/$defs/hzv_contract/properties/practice_participation/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key4},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err64];
}
else {
vErrors.push(err64);
}
errors++;
}
}
if(data21.status !== undefined){
let data25 = data21.status;
if(!(((data25 === "unknown") || (data25 === "confirmed")) || (data25 === "not_participating"))){
const err65 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/practice_participation/status",schemaPath:"#/$defs/hzv_contract/properties/practice_participation/properties/status/enum",keyword:"enum",params:{allowedValues: schema49.properties.practice_participation.properties.status.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err65];
}
else {
vErrors.push(err65);
}
errors++;
}
}
if(data21.valid_from !== undefined){
let data26 = data21.valid_from;
if((typeof data26 !== "string") && (data26 !== null)){
const err66 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/practice_participation/valid_from",schemaPath:"#/$defs/hzv_contract/properties/practice_participation/properties/valid_from/type",keyword:"type",params:{type: schema49.properties.practice_participation.properties.valid_from.type},message:"must be string,null"};
if(vErrors === null){
vErrors = [err66];
}
else {
vErrors.push(err66);
}
errors++;
}
if(typeof data26 === "string"){
if(!(formats0.validate(data26))){
const err67 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/practice_participation/valid_from",schemaPath:"#/$defs/hzv_contract/properties/practice_participation/properties/valid_from/format",keyword:"format",params:{format: "date"},message:"must match format \""+"date"+"\""};
if(vErrors === null){
vErrors = [err67];
}
else {
vErrors.push(err67);
}
errors++;
}
}
}
if(data21.valid_to !== undefined){
let data27 = data21.valid_to;
if((typeof data27 !== "string") && (data27 !== null)){
const err68 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/practice_participation/valid_to",schemaPath:"#/$defs/hzv_contract/properties/practice_participation/properties/valid_to/type",keyword:"type",params:{type: schema49.properties.practice_participation.properties.valid_to.type},message:"must be string,null"};
if(vErrors === null){
vErrors = [err68];
}
else {
vErrors.push(err68);
}
errors++;
}
if(typeof data27 === "string"){
if(!(formats0.validate(data27))){
const err69 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/practice_participation/valid_to",schemaPath:"#/$defs/hzv_contract/properties/practice_participation/properties/valid_to/format",keyword:"format",params:{format: "date"},message:"must match format \""+"date"+"\""};
if(vErrors === null){
vErrors = [err69];
}
else {
vErrors.push(err69);
}
errors++;
}
}
}
if(data21.evidence_ref !== undefined){
let data28 = data21.evidence_ref;
if((typeof data28 !== "string") && (data28 !== null)){
const err70 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/practice_participation/evidence_ref",schemaPath:"#/$defs/hzv_contract/properties/practice_participation/properties/evidence_ref/type",keyword:"type",params:{type: schema49.properties.practice_participation.properties.evidence_ref.type},message:"must be string,null"};
if(vErrors === null){
vErrors = [err70];
}
else {
vErrors.push(err70);
}
errors++;
}
}
}
else {
const err71 = {instancePath:instancePath+"/hzv/contracts/" + i2+"/practice_participation",schemaPath:"#/$defs/hzv_contract/properties/practice_participation/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err71];
}
else {
vErrors.push(err71);
}
errors++;
}
}
}
else {
const err72 = {instancePath:instancePath+"/hzv/contracts/" + i2,schemaPath:"#/$defs/hzv_contract/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err72];
}
else {
vErrors.push(err72);
}
errors++;
}
}
}
else {
const err73 = {instancePath:instancePath+"/hzv/contracts",schemaPath:"#/properties/hzv/properties/contracts/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err73];
}
else {
vErrors.push(err73);
}
errors++;
}
}
}
else {
const err74 = {instancePath:instancePath+"/hzv",schemaPath:"#/properties/hzv/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err74];
}
else {
vErrors.push(err74);
}
errors++;
}
}
if(data.analysis !== undefined){
let data29 = data.analysis;
if(data29 && typeof data29 == "object" && !Array.isArray(data29)){
if(data29.default_scope === undefined){
const err75 = {instancePath:instancePath+"/analysis",schemaPath:"#/properties/analysis/required",keyword:"required",params:{missingProperty: "default_scope"},message:"must have required property '"+"default_scope"+"'"};
if(vErrors === null){
vErrors = [err75];
}
else {
vErrors.push(err75);
}
errors++;
}
if(data29.unknown_condition_policy === undefined){
const err76 = {instancePath:instancePath+"/analysis",schemaPath:"#/properties/analysis/required",keyword:"required",params:{missingProperty: "unknown_condition_policy"},message:"must have required property '"+"unknown_condition_policy"+"'"};
if(vErrors === null){
vErrors = [err76];
}
else {
vErrors.push(err76);
}
errors++;
}
if(data29.date_basis === undefined){
const err77 = {instancePath:instancePath+"/analysis",schemaPath:"#/properties/analysis/required",keyword:"required",params:{missingProperty: "date_basis"},message:"must have required property '"+"date_basis"+"'"};
if(vErrors === null){
vErrors = [err77];
}
else {
vErrors.push(err77);
}
errors++;
}
for(const key5 in data29){
if(!(((key5 === "default_scope") || (key5 === "unknown_condition_policy")) || (key5 === "date_basis"))){
const err78 = {instancePath:instancePath+"/analysis",schemaPath:"#/properties/analysis/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key5},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err78];
}
else {
vErrors.push(err78);
}
errors++;
}
}
if(data29.default_scope !== undefined){
let data30 = data29.default_scope;
if(!((((data30 === "selected_date") || (data30 === "date_range")) || (data30 === "quarter")) || (data30 === "whole_record"))){
const err79 = {instancePath:instancePath+"/analysis/default_scope",schemaPath:"#/properties/analysis/properties/default_scope/enum",keyword:"enum",params:{allowedValues: schema48.properties.analysis.properties.default_scope.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err79];
}
else {
vErrors.push(err79);
}
errors++;
}
}
if(data29.unknown_condition_policy !== undefined){
if("not_verifiable" !== data29.unknown_condition_policy){
const err80 = {instancePath:instancePath+"/analysis/unknown_condition_policy",schemaPath:"#/properties/analysis/properties/unknown_condition_policy/const",keyword:"const",params:{allowedValue: "not_verifiable"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err80];
}
else {
vErrors.push(err80);
}
errors++;
}
}
if(data29.date_basis !== undefined){
if("service_date" !== data29.date_basis){
const err81 = {instancePath:instancePath+"/analysis/date_basis",schemaPath:"#/properties/analysis/properties/date_basis/const",keyword:"const",params:{allowedValue: "service_date"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err81];
}
else {
vErrors.push(err81);
}
errors++;
}
}
}
else {
const err82 = {instancePath:instancePath+"/analysis",schemaPath:"#/properties/analysis/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err82];
}
else {
vErrors.push(err82);
}
errors++;
}
}
if(data.safety !== undefined){
let data33 = data.safety;
if(data33 && typeof data33 == "object" && !Array.isArray(data33)){
if(data33.auto_submit_billing === undefined){
const err83 = {instancePath:instancePath+"/safety",schemaPath:"#/properties/safety/required",keyword:"required",params:{missingProperty: "auto_submit_billing"},message:"must have required property '"+"auto_submit_billing"+"'"};
if(vErrors === null){
vErrors = [err83];
}
else {
vErrors.push(err83);
}
errors++;
}
if(data33.auto_write_to_duria === undefined){
const err84 = {instancePath:instancePath+"/safety",schemaPath:"#/properties/safety/required",keyword:"required",params:{missingProperty: "auto_write_to_duria"},message:"must have required property '"+"auto_write_to_duria"+"'"};
if(vErrors === null){
vErrors = [err84];
}
else {
vErrors.push(err84);
}
errors++;
}
if(data33.require_patient_context_recheck === undefined){
const err85 = {instancePath:instancePath+"/safety",schemaPath:"#/properties/safety/required",keyword:"required",params:{missingProperty: "require_patient_context_recheck"},message:"must have required property '"+"require_patient_context_recheck"+"'"};
if(vErrors === null){
vErrors = [err85];
}
else {
vErrors.push(err85);
}
errors++;
}
if(data33.allow_patient_data_in_project_files === undefined){
const err86 = {instancePath:instancePath+"/safety",schemaPath:"#/properties/safety/required",keyword:"required",params:{missingProperty: "allow_patient_data_in_project_files"},message:"must have required property '"+"allow_patient_data_in_project_files"+"'"};
if(vErrors === null){
vErrors = [err86];
}
else {
vErrors.push(err86);
}
errors++;
}
for(const key6 in data33){
if(!((((key6 === "auto_submit_billing") || (key6 === "auto_write_to_duria")) || (key6 === "require_patient_context_recheck")) || (key6 === "allow_patient_data_in_project_files"))){
const err87 = {instancePath:instancePath+"/safety",schemaPath:"#/properties/safety/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key6},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err87];
}
else {
vErrors.push(err87);
}
errors++;
}
}
if(data33.auto_submit_billing !== undefined){
if(false !== data33.auto_submit_billing){
const err88 = {instancePath:instancePath+"/safety/auto_submit_billing",schemaPath:"#/properties/safety/properties/auto_submit_billing/const",keyword:"const",params:{allowedValue: false},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err88];
}
else {
vErrors.push(err88);
}
errors++;
}
}
if(data33.auto_write_to_duria !== undefined){
if(false !== data33.auto_write_to_duria){
const err89 = {instancePath:instancePath+"/safety/auto_write_to_duria",schemaPath:"#/properties/safety/properties/auto_write_to_duria/const",keyword:"const",params:{allowedValue: false},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err89];
}
else {
vErrors.push(err89);
}
errors++;
}
}
if(data33.require_patient_context_recheck !== undefined){
if(true !== data33.require_patient_context_recheck){
const err90 = {instancePath:instancePath+"/safety/require_patient_context_recheck",schemaPath:"#/properties/safety/properties/require_patient_context_recheck/const",keyword:"const",params:{allowedValue: true},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err90];
}
else {
vErrors.push(err90);
}
errors++;
}
}
if(data33.allow_patient_data_in_project_files !== undefined){
if(false !== data33.allow_patient_data_in_project_files){
const err91 = {instancePath:instancePath+"/safety/allow_patient_data_in_project_files",schemaPath:"#/properties/safety/properties/allow_patient_data_in_project_files/const",keyword:"const",params:{allowedValue: false},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err91];
}
else {
vErrors.push(err91);
}
errors++;
}
}
}
else {
const err92 = {instancePath:instancePath+"/safety",schemaPath:"#/properties/safety/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err92];
}
else {
vErrors.push(err92);
}
errors++;
}
}
}
else {
const err93 = {instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err93];
}
else {
vErrors.push(err93);
}
errors++;
}
validate27.errors = vErrors;
return errors === 0;
}
validate27.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};

