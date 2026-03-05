---
status: diagnosed
trigger: "Investigate why creating a campaign shows 'Kampanya kaydedilirken bir hata olustu' error"
created: 2026-03-05T12:00:00Z
updated: 2026-03-05T12:00:00Z
---

## Current Focus

hypothesis: Next.js redirect() throws a NEXT_REDIRECT error that is caught by the generic catch block in the form component, triggering a false error alert even though the campaign was successfully created
test: Code path analysis of createCampaign -> redirect -> catch block in campaign-form.tsx
expecting: redirect() throws internally, catch block treats it as an error
next_action: DIAGNOSED - return findings

## Symptoms

expected: Campaign form submits, campaign is created, user is redirected to /admin/campaigns without error
actual: Campaign IS created successfully, but user sees "Kampanya kaydedilirken bir hata olustu" alert before (or instead of) redirect
errors: "Kampanya kaydedilirken bir hata olustu" (alert in catch block)
reproduction: Go to /admin/campaigns/new, fill in form, submit
started: Always been this way (design bug)

## Eliminated

(none needed - root cause found on first hypothesis)

## Evidence

- timestamp: 2026-03-05T12:01:00Z
  checked: src/lib/actions/campaigns.ts createCampaign function (lines 226-281)
  found: Function calls redirect('/admin/campaigns') at line 280 after successful insert. redirect() in Next.js works by throwing a special NEXT_REDIRECT error internally.
  implication: This throw propagates to the calling code.

- timestamp: 2026-03-05T12:02:00Z
  checked: src/components/admin/campaign-form.tsx handleSubmit (lines 22-38)
  found: The form calls createCampaign(formData) inside a try/catch. The catch block (line 34-38) catches ALL errors generically and shows alert('Kampanya kaydedilirken bir hata olustu'). It does not distinguish between actual errors and the NEXT_REDIRECT special error thrown by redirect().
  implication: This is the root cause. The redirect() throw is caught as a "failure", triggering the error alert even though the DB insert succeeded.

- timestamp: 2026-03-05T12:03:00Z
  checked: src/lib/actions/products.ts createProduct function for comparison
  found: Products use useFormState/useActionState pattern (returns ActionState object, does not throw). Only calls redirect() after successful insert. The form component uses the returned state for error display rather than try/catch.
  implication: Products don't have this bug because they use a different pattern. Campaigns use a direct async call + try/catch pattern that is incompatible with redirect().

- timestamp: 2026-03-05T12:04:00Z
  checked: Database schema (007_dashboard_campaigns.sql)
  found: campaigns table has NO company_id column. No multi-tenant scoping. RLS policies check users.role='admin' for management. No company_id insertion issue.
  implication: Database layer is not the problem. The insert succeeds (which is why the campaign appears in the list).

## Resolution

root_cause: Next.js redirect() works by throwing a special internal error (NEXT_REDIRECT). In src/components/admin/campaign-form.tsx, the handleSubmit function wraps the createCampaign() server action call in a try/catch block. When the server action succeeds and calls redirect('/admin/campaigns'), the redirect throw propagates to the client-side catch block, which treats it as a failure and shows the error alert. The campaign IS created successfully in the database -- the error message is a false positive caused by catching the redirect's internal throw mechanism.
fix: (not applied - diagnosis only)
verification: (not applied - diagnosis only)
files_changed: []
