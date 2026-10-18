import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { contactEditInput, workflowInput, stages } from "./workflow-contracts";
const fixture=JSON.parse(readFileSync("packages/contracts/fixtures/contact-detail.json","utf8"));
const spec=JSON.parse(readFileSync("packages/contracts/openapi.json","utf8"));
it("keeps shared workflow examples compatible with write validation",()=> {
 const c=fixture.contact;
 expect(contactEditInput.safeParse({id:c.id,full_name:c.full_name,email:c.email,phone:c.phone || "",source:c.source,owner_id:c.owner_id,expected_version:c.version}).success).toBe(true);
 const o=fixture.opportunities[0], t=fixture.tasks[0];
 expect(workflowInput.safeParse({action:"stage",id:o.id,stage:o.stage,expected_version:o.version}).success).toBe(true);
 expect(workflowInput.safeParse({action:"task",id:t.id,title:t.title,assignee_id:t.assignee_id,opportunity_id:t.opportunity_id,due_at:t.due_at}).success).toBe(true);
 expect(spec.components.schemas.CRMOpportunity.properties.stage.enum).toEqual(stages);
 expect(spec.components.schemas.WorkflowInput.oneOf.map((v:{properties:{action:{const:string}}})=>v.properties.action.const).sort()).toEqual(["note","opportunity","opportunity_edit","stage","task","task_status"]);
});
it("rejects invalid or fractional cents and caller-selected actor fields",()=> {
 const input={action:"opportunity",id:fixture.contact.id,title:"Trial",owner_id:null,value_cents:1,next_action:""};
 expect(workflowInput.safeParse({...input,value_cents:1.5}).success).toBe(false);
 expect(workflowInput.safeParse({...input,created_by:fixture.contact.id}).success).toBe(false);
 expect(workflowInput.safeParse({...input,linked_user_id:fixture.contact.id}).success).toBe(false);
});
