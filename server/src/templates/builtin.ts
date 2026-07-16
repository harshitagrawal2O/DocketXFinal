import type { TemplateDraft } from "@docket/shared";

export interface BuiltinTemplate extends TemplateDraft {
  id: string;
}

/**
 * Curated library of standard-form Indian legal & CA document templates.
 *
 * These are original, authored standard-form drafts that follow public
 * statutory formats. They intentionally use the CURRENT Indian statutory
 * framework (Companies Act 2013; CGST/IGST Acts 2017; Income-tax Act 1961;
 * Arbitration and Conciliation Act 1996; Bharatiya Nyaya Sanhita 2023;
 * Bharatiya Nagarik Suraksha Sanhita 2023; Bharatiya Sakshya Adhiniyam 2023).
 *
 * Placeholders use the {{snake_case}} convention and each has a matching
 * entry in the template's `variables` array.
 */
export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  // 1. Mutual Non-Disclosure Agreement
  {
    id: "bt_nda_mutual",
    title: "Mutual Non-Disclosure Agreement",
    category: "agreement",
    kind: "contract",
    description:
      "Two-way confidentiality agreement for exchanging proprietary information during discussions or a proposed transaction.",
    variables: [
      { key: "execution_date", label: "Date of Execution", type: "date", required: true },
      { key: "party_one_name", label: "First Party Name", type: "party", required: true },
      { key: "party_one_address", label: "First Party Address", type: "text", required: true },
      { key: "party_two_name", label: "Second Party Name", type: "party", required: true },
      { key: "party_two_address", label: "Second Party Address", type: "text", required: true },
      { key: "purpose", label: "Purpose of Disclosure", type: "longtext", required: true, hint: "e.g. evaluating a potential commercial collaboration" },
      { key: "term_years", label: "Term (years)", type: "number", required: true },
      { key: "survival_years", label: "Confidentiality Survival (years)", type: "number", required: true },
      { key: "arbitration_seat", label: "Arbitration Seat / City", type: "text", required: true },
      { key: "governing_law_state", label: "Governing Law (State/UT)", type: "text", required: true },
      { key: "stamp_place", label: "Place of Execution", type: "text", required: true },
    ],
    bodyHtml: `<h1>MUTUAL NON-DISCLOSURE AGREEMENT</h1>
<p>This Mutual Non-Disclosure Agreement (the &ldquo;<strong>Agreement</strong>&rdquo;) is made and executed on {{execution_date}} at {{stamp_place}}.</p>
<p><strong>BETWEEN</strong></p>
<p><strong>{{party_one_name}}</strong>, having its principal address at {{party_one_address}} (hereinafter the &ldquo;First Party&rdquo;);</p>
<p><strong>AND</strong></p>
<p><strong>{{party_two_name}}</strong>, having its principal address at {{party_two_address}} (hereinafter the &ldquo;Second Party&rdquo;).</p>
<p>The First Party and the Second Party are individually referred to as a &ldquo;Party&rdquo; and collectively as the &ldquo;Parties&rdquo;. Each Party may act as a disclosing party (&ldquo;Disclosing Party&rdquo;) or a receiving party (&ldquo;Receiving Party&rdquo;).</p>
<h2>1. Purpose</h2>
<p>The Parties wish to exchange certain confidential information for the purpose of {{purpose}} (the &ldquo;Purpose&rdquo;).</p>
<h2>2. Confidential Information</h2>
<p>&ldquo;Confidential Information&rdquo; means all non-public information disclosed by the Disclosing Party, whether oral, written, electronic or in any other form, including business plans, financial data, customer lists, technical data, know-how, and trade secrets, whether or not marked as confidential.</p>
<h2>3. Obligations of Confidentiality</h2>
<ol>
<li>The Receiving Party shall use the Confidential Information solely for the Purpose.</li>
<li>The Receiving Party shall protect the Confidential Information with the same degree of care it uses for its own confidential information, and not less than reasonable care.</li>
<li>The Receiving Party shall not disclose the Confidential Information to any third party except to its officers, employees and professional advisers on a strict need-to-know basis, who are bound by obligations no less protective than those herein.</li>
</ol>
<h2>4. Exclusions</h2>
<p>The obligations shall not apply to information that: (a) is or becomes publicly available without breach; (b) was lawfully known prior to disclosure; (c) is independently developed without use of the Confidential Information; or (d) is required to be disclosed by law or a competent authority, provided prompt written notice is given where lawful.</p>
<h2>5. Term and Survival</h2>
<p>This Agreement shall remain in force for {{term_years}} year(s) from the date hereof. The confidentiality obligations shall survive for {{survival_years}} year(s) after termination or expiry.</p>
<h2>6. No Licence</h2>
<p>Nothing in this Agreement grants any licence, right, or interest in any intellectual property. All Confidential Information remains the property of the Disclosing Party.</p>
<h2>7. Governing Law and Dispute Resolution</h2>
<p>This Agreement shall be governed by and construed in accordance with the laws of India, and the courts at {{governing_law_state}} shall have jurisdiction. Any dispute arising out of or in connection with this Agreement shall be referred to arbitration by a sole arbitrator under the Arbitration and Conciliation Act, 1996. The seat and venue of arbitration shall be {{arbitration_seat}}, and the language shall be English.</p>
<h2>8. Notices</h2>
<p>All notices shall be in writing and delivered to the respective addresses set out above, by hand, registered post, or email with acknowledgement.</p>
<h2>9. Stamp Duty and Execution</h2>
<p>This Agreement is executed in duplicate, and stamp duty payable under the applicable State Stamp Act at {{stamp_place}} shall be borne by the Parties equally.</p>
<p><strong>IN WITNESS WHEREOF</strong> the Parties have executed this Agreement on the date first written above.</p>
<p><br>For {{party_one_name}}<br>_____________________________<br>(Authorised Signatory)</p>
<p><br>For {{party_two_name}}<br>_____________________________<br>(Authorised Signatory)</p>`,
  },

  // 2. Master Services Agreement
  {
    id: "bt_msa",
    title: "Master Services Agreement",
    category: "agreement",
    kind: "contract",
    description:
      "Framework agreement governing recurring services delivered under statements of work, with payment, IP and liability terms.",
    variables: [
      { key: "execution_date", label: "Date of Execution", type: "date", required: true },
      { key: "client_name", label: "Client Name", type: "party", required: true },
      { key: "client_address", label: "Client Address", type: "text", required: true },
      { key: "provider_name", label: "Service Provider Name", type: "party", required: true },
      { key: "provider_address", label: "Service Provider Address", type: "text", required: true },
      { key: "services_scope", label: "Scope of Services", type: "longtext", required: true },
      { key: "fees", label: "Fees / Rate", type: "amount", required: true },
      { key: "payment_days", label: "Payment Term (days)", type: "number", required: true },
      { key: "term_years", label: "Initial Term (years)", type: "number", required: true },
      { key: "termination_notice_days", label: "Termination Notice (days)", type: "number", required: true },
      { key: "liability_cap", label: "Liability Cap", type: "amount", required: true, hint: "e.g. fees paid in the preceding 12 months" },
      { key: "arbitration_seat", label: "Arbitration Seat / City", type: "text", required: true },
      { key: "governing_law_state", label: "Governing Law (State/UT)", type: "text", required: true },
      { key: "stamp_place", label: "Place of Execution", type: "text", required: true },
    ],
    bodyHtml: `<h1>MASTER SERVICES AGREEMENT</h1>
<p>This Master Services Agreement (the &ldquo;<strong>Agreement</strong>&rdquo;) is entered into on {{execution_date}} at {{stamp_place}}.</p>
<p><strong>BETWEEN</strong> <strong>{{client_name}}</strong>, having its registered/principal office at {{client_address}} (the &ldquo;Client&rdquo;); <strong>AND</strong> <strong>{{provider_name}}</strong>, having its registered/principal office at {{provider_address}} (the &ldquo;Service Provider&rdquo;).</p>
<h2>1. Structure</h2>
<p>This Agreement sets out the general terms governing services. Specific engagements shall be documented in individual Statements of Work (&ldquo;SOWs&rdquo;) executed by both Parties, each of which shall incorporate and be subject to this Agreement. In the event of conflict, the SOW prevails for that engagement.</p>
<h2>2. Scope of Services</h2>
<p>The Service Provider shall provide the following services and such other services as agreed in an SOW: {{services_scope}}. The Service Provider shall perform the Services in a professional and workmanlike manner using suitably skilled personnel.</p>
<h2>3. Fees and Payment</h2>
<ol>
<li>The Client shall pay fees of {{fees}}, exclusive of applicable Goods and Services Tax, which shall be charged as per the CGST/IGST Acts, 2017.</li>
<li>Undisputed invoices shall be paid within {{payment_days}} days of receipt.</li>
<li>Tax shall be deducted at source as required under the Income-tax Act, 1961, and a TDS certificate provided.</li>
</ol>
<h2>4. Term and Termination</h2>
<p>This Agreement shall commence on the date hereof and continue for {{term_years}} year(s), renewable by mutual consent. Either Party may terminate this Agreement or any SOW for convenience on {{termination_notice_days}} days&rsquo; prior written notice, or immediately for material breach not cured within thirty (30) days of notice.</p>
<h2>5. Intellectual Property</h2>
<p>Subject to full payment, all deliverables created specifically for the Client under an SOW shall vest in the Client upon delivery. The Service Provider retains ownership of its pre-existing tools, methodologies and know-how, and grants the Client a non-exclusive licence to use the same as embedded in the deliverables.</p>
<h2>6. Confidentiality</h2>
<p>Each Party shall keep confidential all non-public information of the other Party and use it only to perform this Agreement. This obligation survives termination for three (3) years.</p>
<h2>7. Limitation of Liability</h2>
<p>Save for breach of confidentiality, indemnity obligations, or wilful misconduct, the aggregate liability of either Party shall not exceed {{liability_cap}}. Neither Party shall be liable for indirect, incidental or consequential loss.</p>
<h2>8. Governing Law and Dispute Resolution</h2>
<p>This Agreement is governed by the laws of India and subject to the jurisdiction of courts at {{governing_law_state}}. Disputes shall be referred to arbitration by a sole arbitrator under the Arbitration and Conciliation Act, 1996, with seat and venue at {{arbitration_seat}} and proceedings in English.</p>
<h2>9. Notices and Execution</h2>
<p>Notices shall be in writing to the addresses above. Stamp duty as applicable at {{stamp_place}} shall be borne by the Client. This Agreement is executed in duplicate.</p>
<p><br>For {{client_name}}<br>_____________________________<br>(Authorised Signatory)</p>
<p><br>For {{provider_name}}<br>_____________________________<br>(Authorised Signatory)</p>`,
  },

  // 3. Consultancy / Professional Services Agreement
  {
    id: "bt_consultancy",
    title: "Consultancy / Professional Services Agreement",
    category: "agreement",
    kind: "contract",
    description:
      "Independent consultant engagement setting out deliverables, fees, IP assignment and an express no-employment relationship.",
    variables: [
      { key: "execution_date", label: "Date of Execution", type: "date", required: true },
      { key: "company_name", label: "Company Name", type: "party", required: true },
      { key: "company_address", label: "Company Address", type: "text", required: true },
      { key: "consultant_name", label: "Consultant Name", type: "party", required: true },
      { key: "consultant_address", label: "Consultant Address", type: "text", required: true },
      { key: "engagement_scope", label: "Scope of Engagement", type: "longtext", required: true },
      { key: "professional_fee", label: "Professional Fee", type: "amount", required: true },
      { key: "payment_schedule", label: "Payment Schedule", type: "text", required: true, hint: "e.g. monthly in arrears / on milestone" },
      { key: "engagement_term", label: "Engagement Term", type: "text", required: true, hint: "e.g. 12 months from the date hereof" },
      { key: "notice_days", label: "Termination Notice (days)", type: "number", required: true },
      { key: "arbitration_seat", label: "Arbitration Seat / City", type: "text", required: true },
      { key: "governing_law_state", label: "Governing Law (State/UT)", type: "text", required: true },
      { key: "stamp_place", label: "Place of Execution", type: "text", required: true },
    ],
    bodyHtml: `<h1>CONSULTANCY AGREEMENT</h1>
<p>This Consultancy Agreement (the &ldquo;<strong>Agreement</strong>&rdquo;) is made on {{execution_date}} at {{stamp_place}}.</p>
<p><strong>BETWEEN</strong> <strong>{{company_name}}</strong>, having its office at {{company_address}} (the &ldquo;Company&rdquo;); <strong>AND</strong> <strong>{{consultant_name}}</strong>, residing/having its office at {{consultant_address}} (the &ldquo;Consultant&rdquo;).</p>
<h2>1. Engagement</h2>
<p>The Company engages the Consultant, and the Consultant accepts the engagement, to provide the following professional services on a non-exclusive basis: {{engagement_scope}} (the &ldquo;Services&rdquo;).</p>
<h2>2. Independent Contractor</h2>
<p>The Consultant is engaged as an independent contractor. Nothing in this Agreement creates any relationship of employer-employee, partnership, agency or joint venture. The Consultant shall be solely responsible for its own taxes, statutory contributions and compliances.</p>
<h2>3. Term and Termination</h2>
<p>The engagement shall subsist for {{engagement_term}}, unless terminated earlier. Either Party may terminate this Agreement on {{notice_days}} days&rsquo; written notice, or forthwith for material breach or misconduct.</p>
<h2>4. Fees</h2>
<ol>
<li>In consideration of the Services, the Company shall pay a professional fee of {{professional_fee}}, payable {{payment_schedule}}.</li>
<li>Fees are exclusive of Goods and Services Tax, which shall be charged as applicable under the CGST/IGST Acts, 2017.</li>
<li>Tax shall be deducted at source under the Income-tax Act, 1961, as applicable.</li>
</ol>
<h2>5. Standard of Performance</h2>
<p>The Consultant shall perform the Services with due skill, care and diligence, in compliance with applicable law and the Company&rsquo;s reasonable directions, and shall avoid any conflict of interest.</p>
<h2>6. Intellectual Property</h2>
<p>All work product, deliverables, reports and materials developed by the Consultant in the course of the Services shall, upon creation and subject to payment, be the exclusive property of the Company. The Consultant hereby assigns all rights therein to the Company and shall execute documents necessary to perfect such assignment.</p>
<h2>7. Confidentiality</h2>
<p>The Consultant shall maintain in strict confidence all confidential and proprietary information of the Company, both during and after the engagement, and shall not use it except to perform the Services.</p>
<h2>8. Governing Law and Dispute Resolution</h2>
<p>This Agreement shall be governed by the laws of India, subject to the jurisdiction of the courts at {{governing_law_state}}. Any dispute shall be resolved by arbitration by a sole arbitrator under the Arbitration and Conciliation Act, 1996, with seat and venue at {{arbitration_seat}} and proceedings in English.</p>
<h2>9. Execution and Stamp Duty</h2>
<p>This Agreement is executed in duplicate. Stamp duty as applicable at {{stamp_place}} shall be borne by the Company.</p>
<p><br>For {{company_name}}<br>_____________________________<br>(Authorised Signatory)</p>
<p><br>{{consultant_name}}<br>_____________________________<br>(Consultant)</p>`,
  },

  // 4. Employment Agreement
  {
    id: "bt_employment",
    title: "Employment Agreement",
    category: "employment",
    kind: "contract",
    description:
      "Standard-form appointment letter cum employment agreement covering role, remuneration, probation, and post-employment covenants.",
    variables: [
      { key: "execution_date", label: "Date of Execution", type: "date", required: true },
      { key: "employer_name", label: "Employer Name", type: "party", required: true },
      { key: "employer_address", label: "Employer Address", type: "text", required: true },
      { key: "employee_name", label: "Employee Name", type: "party", required: true },
      { key: "employee_address", label: "Employee Address", type: "text", required: true },
      { key: "designation", label: "Designation", type: "text", required: true },
      { key: "joining_date", label: "Date of Joining", type: "date", required: true },
      { key: "work_location", label: "Work Location", type: "text", required: true },
      { key: "ctc", label: "Annual CTC", type: "amount", required: true },
      { key: "probation_months", label: "Probation Period (months)", type: "number", required: true },
      { key: "notice_period_days", label: "Notice Period (days)", type: "number", required: true },
      { key: "governing_law_state", label: "Governing Law (State/UT)", type: "text", required: true },
      { key: "stamp_place", label: "Place of Execution", type: "text", required: true },
    ],
    bodyHtml: `<h1>EMPLOYMENT AGREEMENT</h1>
<p>This Employment Agreement (the &ldquo;<strong>Agreement</strong>&rdquo;) is made on {{execution_date}} at {{stamp_place}}.</p>
<p><strong>BETWEEN</strong> <strong>{{employer_name}}</strong>, having its registered office at {{employer_address}} (the &ldquo;Company&rdquo;); <strong>AND</strong> <strong>{{employee_name}}</strong>, residing at {{employee_address}} (the &ldquo;Employee&rdquo;).</p>
<h2>1. Appointment and Duties</h2>
<p>The Company appoints the Employee to the position of <strong>{{designation}}</strong> with effect from {{joining_date}}. The Employee shall perform the duties reasonably assigned, devote his/her whole time and attention to the Company&rsquo;s business, and comply with all applicable policies and lawful directions.</p>
<h2>2. Place of Work</h2>
<p>The Employee&rsquo;s primary place of work shall be {{work_location}}. The Company may require the Employee to work at or relocate to other locations as reasonably necessary.</p>
<h2>3. Remuneration</h2>
<p>The Employee shall be paid a total cost to company of {{ctc}} per annum, payable monthly, subject to deduction of tax at source under the Income-tax Act, 1961, and statutory deductions towards provident fund, ESI and professional tax as applicable.</p>
<h2>4. Probation and Confirmation</h2>
<p>The Employee shall be on probation for {{probation_months}} month(s), which may be extended at the Company&rsquo;s discretion. On satisfactory completion, the Employee&rsquo;s services shall be confirmed in writing.</p>
<h2>5. Working Hours and Leave</h2>
<p>The Employee shall observe the Company&rsquo;s working hours and shall be entitled to leave in accordance with Company policy and applicable law.</p>
<h2>6. Termination and Notice</h2>
<p>After confirmation, either Party may terminate this Agreement on {{notice_period_days}} days&rsquo; written notice or salary in lieu thereof. The Company may terminate forthwith without notice for misconduct, breach of policy, or acts prejudicial to its interests, following applicable process.</p>
<h2>7. Confidentiality and Intellectual Property</h2>
<p>The Employee shall keep confidential all trade secrets and proprietary information of the Company during and after employment. All intellectual property created in the course of employment shall vest exclusively in the Company.</p>
<h2>8. Post-Employment Covenants</h2>
<p>For a reasonable period after cessation of employment, the Employee shall not solicit the Company&rsquo;s clients or employees, to the extent permissible under applicable law.</p>
<h2>9. Governing Law and Jurisdiction</h2>
<p>This Agreement shall be governed by the laws of India, and the courts at {{governing_law_state}} shall have exclusive jurisdiction. Applicable labour and industrial legislation shall prevail to the extent it confers superior statutory rights on the Employee.</p>
<h2>10. Execution</h2>
<p>This Agreement is executed in duplicate at {{stamp_place}} and each Party acknowledges receipt of a signed copy.</p>
<p><br>For {{employer_name}}<br>_____________________________<br>(Authorised Signatory)</p>
<p><br>{{employee_name}}<br>_____________________________<br>(Employee)</p>`,
  },

  // 5. Founders' Agreement
  {
    id: "bt_founders_agreement",
    title: "Founders' Agreement",
    category: "corporate",
    kind: "contract",
    description:
      "Agreement among co-founders recording equity split, roles, vesting, IP assignment and exit/leaver provisions.",
    variables: [
      { key: "execution_date", label: "Date of Execution", type: "date", required: true },
      { key: "company_name", label: "Company Name", type: "party", required: true },
      { key: "company_address", label: "Company / Proposed Registered Office", type: "text", required: true },
      { key: "founder_details", label: "Founders and Equity Split", type: "longtext", required: true, hint: "e.g. A - 40%, B - 35%, C - 25%" },
      { key: "business_description", label: "Business Description", type: "longtext", required: true },
      { key: "roles_responsibilities", label: "Roles and Responsibilities", type: "longtext", required: true },
      { key: "vesting_years", label: "Vesting Period (years)", type: "number", required: true },
      { key: "cliff_months", label: "Cliff Period (months)", type: "number", required: true },
      { key: "arbitration_seat", label: "Arbitration Seat / City", type: "text", required: true },
      { key: "governing_law_state", label: "Governing Law (State/UT)", type: "text", required: true },
      { key: "stamp_place", label: "Place of Execution", type: "text", required: true },
    ],
    bodyHtml: `<h1>FOUNDERS&rsquo; AGREEMENT</h1>
<p>This Founders&rsquo; Agreement (the &ldquo;<strong>Agreement</strong>&rdquo;) is made on {{execution_date}} at {{stamp_place}} among the persons described below (each a &ldquo;Founder&rdquo; and collectively the &ldquo;Founders&rdquo;) in relation to <strong>{{company_name}}</strong>, a company incorporated / proposed to be incorporated under the Companies Act, 2013, having its office at {{company_address}} (the &ldquo;Company&rdquo;).</p>
<h2>1. The Business</h2>
<p>The Founders have agreed to carry on the following business through the Company: {{business_description}}.</p>
<h2>2. Shareholding</h2>
<p>The Founders shall hold equity share capital in the Company in the following proportions: {{founder_details}}. Any future issue of shares, transfer, or dilution shall be undertaken only in accordance with this Agreement, the Articles of Association, and the Companies Act, 2013.</p>
<h2>3. Roles and Responsibilities</h2>
<p>The Founders shall discharge their respective roles as follows: {{roles_responsibilities}}. Each Founder shall devote substantially his/her full working time to the Company unless otherwise agreed in writing.</p>
<h2>4. Vesting</h2>
<p>The equity of each Founder shall vest over a period of {{vesting_years}} year(s), subject to a cliff of {{cliff_months}} month(s). Unvested shares of a Founder who ceases to be associated with the Company (a &ldquo;Leaver&rdquo;) shall be liable to be repurchased or forfeited as provided herein.</p>
<h2>5. Good Leaver / Bad Leaver</h2>
<p>A Good Leaver&rsquo;s vested shares shall be repurchased at fair value; a Bad Leaver&rsquo;s shares (departure for cause or breach) may be repurchased at the lower of cost or fair value, as determined in good faith.</p>
<h2>6. Intellectual Property</h2>
<p>Each Founder assigns to the Company all intellectual property created in connection with the business, whether before or after incorporation, and shall execute all documents required to perfect such assignment.</p>
<h2>7. Confidentiality and Non-Compete</h2>
<p>Each Founder shall maintain confidentiality of the Company&rsquo;s information and shall not, during association and for a reasonable period thereafter, engage in a competing business, to the extent permissible under applicable law.</p>
<h2>8. Transfer Restrictions</h2>
<p>No Founder shall transfer, pledge or encumber shares without first offering them to the other Founders on a right of first refusal, and subject to tag-along and drag-along rights as the Founders may adopt.</p>
<h2>9. Dispute Resolution and Governing Law</h2>
<p>This Agreement is governed by the laws of India, subject to the jurisdiction of courts at {{governing_law_state}}. Disputes shall be referred to arbitration by a sole arbitrator under the Arbitration and Conciliation Act, 1996, with seat and venue at {{arbitration_seat}}.</p>
<h2>10. Execution</h2>
<p>This Agreement is executed in counterparts, stamped as applicable at {{stamp_place}}, each Founder retaining a signed copy.</p>
<p><br>Signed by the Founders:<br>_____________________________<br>_____________________________<br>_____________________________</p>`,
  },

  // 6. Board Resolution
  {
    id: "bt_board_resolution",
    title: "Board Resolution",
    category: "corporate",
    kind: "filing",
    description:
      "Certified extract of a resolution passed by the Board of Directors authorising a specified corporate action.",
    variables: [
      { key: "company_name", label: "Company Name", type: "party", required: true },
      { key: "cin", label: "Corporate Identity Number (CIN)", type: "text", required: true },
      { key: "registered_office", label: "Registered Office Address", type: "text", required: true },
      { key: "meeting_date", label: "Date of Board Meeting", type: "date", required: true },
      { key: "meeting_time", label: "Time of Meeting", type: "text", required: true },
      { key: "meeting_venue", label: "Venue of Meeting", type: "text", required: true },
      { key: "resolution_subject", label: "Subject of Resolution", type: "text", required: true, hint: "e.g. Opening of a bank account" },
      { key: "resolution_body", label: "Operative Resolution Text", type: "longtext", required: true },
      { key: "authorised_person", label: "Authorised Person Name", type: "party", required: true },
      { key: "authorised_designation", label: "Authorised Person Designation", type: "text", required: true },
      { key: "chairman_name", label: "Chairman / Director Name", type: "party", required: true },
      { key: "certified_date", label: "Date of Certification", type: "date", required: true },
    ],
    bodyHtml: `<h1>CERTIFIED TRUE COPY OF THE RESOLUTION</h1>
<p><strong>{{company_name}}</strong><br>CIN: {{cin}}<br>Registered Office: {{registered_office}}</p>
<p>Certified true copy of the resolution passed at the meeting of the Board of Directors of the Company held on {{meeting_date}} at {{meeting_time}} at {{meeting_venue}}, in accordance with the provisions of the Companies Act, 2013 and the Secretarial Standards issued by the Institute of Company Secretaries of India.</p>
<h2>Subject: {{resolution_subject}}</h2>
<p>The Chairman apprised the Board of the matter placed before it. After due discussion, the Board passed the following resolution:</p>
<p><strong>&ldquo;RESOLVED THAT</strong> {{resolution_body}}</p>
<p><strong>RESOLVED FURTHER THAT</strong> <strong>{{authorised_person}}</strong>, {{authorised_designation}} of the Company, be and is hereby authorised to do all such acts, deeds, matters and things, and to sign and execute all such documents, applications and writings, as may be necessary, incidental or expedient to give effect to the foregoing resolution.</p>
<p><strong>RESOLVED FURTHER THAT</strong> a certified copy of this resolution be furnished to any concerned authority, bank, institution or person as may be required.&rdquo;</p>
<h2>Certification</h2>
<p>Certified to be a true copy of the resolution duly passed and recorded in the minutes of the Board.</p>
<p>For and on behalf of the Board of <strong>{{company_name}}</strong></p>
<p><br>_____________________________<br>{{chairman_name}}<br>(Director / Chairman)<br>Date: {{certified_date}}</p>`,
  },

  // 7. CA Engagement Letter — Statutory Audit / Tax
  {
    id: "bt_ca_audit_engagement",
    title: "Chartered Accountant Engagement Letter (Statutory Audit / Tax)",
    category: "tax-ca",
    kind: "memo",
    description:
      "Engagement letter from a CA firm setting out scope, responsibilities and fees for statutory audit and related tax work.",
    variables: [
      { key: "letter_date", label: "Date of Letter", type: "date", required: true },
      { key: "ca_firm_name", label: "CA Firm Name", type: "party", required: true },
      { key: "ca_firm_frn", label: "Firm Registration Number (FRN)", type: "text", required: true },
      { key: "ca_firm_address", label: "CA Firm Address", type: "text", required: true },
      { key: "client_name", label: "Client Name", type: "party", required: true },
      { key: "client_address", label: "Client Address", type: "text", required: true },
      { key: "financial_year", label: "Financial Year", type: "text", required: true, hint: "e.g. 2025-26" },
      { key: "scope_of_work", label: "Scope of Work", type: "longtext", required: true },
      { key: "professional_fees", label: "Professional Fees", type: "amount", required: true },
      { key: "out_of_pocket", label: "Out-of-Pocket / Travel Basis", type: "text", required: true, hint: "e.g. billed at actuals" },
      { key: "governing_law_state", label: "Governing Law (State/UT)", type: "text", required: true },
    ],
    bodyHtml: `<h1>ENGAGEMENT LETTER &mdash; STATUTORY AUDIT AND TAX</h1>
<p>Date: {{letter_date}}</p>
<p>To,<br>The Board of Directors / Management<br><strong>{{client_name}}</strong><br>{{client_address}}</p>
<p>Dear Sir/Madam,</p>
<p><strong>Subject: Engagement for statutory audit and related tax services for the financial year {{financial_year}}</strong></p>
<p>We, <strong>{{ca_firm_name}}</strong>, Chartered Accountants (FRN: {{ca_firm_frn}}), having our office at {{ca_firm_address}}, are pleased to set out the terms of our engagement.</p>
<h2>1. Scope of Services</h2>
<p>Our engagement covers the following: {{scope_of_work}}. The statutory audit will be conducted in accordance with the Standards on Auditing issued by the Institute of Chartered Accountants of India and the requirements of the Companies Act, 2013. Tax compliance work will be carried out in accordance with the Income-tax Act, 1961 and the CGST/IGST Acts, 2017, as applicable.</p>
<h2>2. Management&rsquo;s Responsibility</h2>
<p>The preparation and fair presentation of the financial statements, maintenance of adequate accounting records and internal controls, safeguarding of assets, and compliance with applicable laws remain the responsibility of the Management. Management shall provide us with complete and accurate information and access to records, and shall provide a written representation letter.</p>
<h2>3. Auditor&rsquo;s Responsibility</h2>
<p>Our responsibility is to express an independent opinion on the financial statements based on our audit. An audit involves performing procedures on a test basis and is subject to the inherent limitations of audit; accordingly, there is an unavoidable risk that some material misstatements may not be detected.</p>
<h2>4. Fees</h2>
<p>Our professional fees for this engagement will be {{professional_fees}}, plus applicable Goods and Services Tax. Out-of-pocket and travelling expenses will be {{out_of_pocket}}. Fees are payable on presentation of invoices, subject to tax deducted at source under the Income-tax Act, 1961.</p>
<h2>5. Confidentiality and Independence</h2>
<p>We shall maintain confidentiality of your information and comply with the ethical and independence requirements of the Chartered Accountants Act, 1949 and the ICAI Code of Ethics.</p>
<h2>6. Governing Law</h2>
<p>This engagement is governed by the laws of India, subject to the jurisdiction of the courts at {{governing_law_state}}.</p>
<p>Please confirm your acceptance of these terms by signing and returning the enclosed copy of this letter.</p>
<p>Yours faithfully,<br>For <strong>{{ca_firm_name}}</strong><br>Chartered Accountants<br>FRN: {{ca_firm_frn}}</p>
<p><br>_____________________________<br>(Partner / Proprietor)</p>
<p><br><strong>Accepted for and on behalf of {{client_name}}</strong><br>_____________________________<br>(Authorised Signatory)</p>`,
  },

  // 8. GST Advisory / Retainer Engagement Letter
  {
    id: "bt_gst_retainer",
    title: "GST Advisory / Retainer Engagement Letter",
    category: "tax-ca",
    kind: "memo",
    description:
      "Retainer engagement letter for ongoing GST compliance, return filing and advisory services.",
    variables: [
      { key: "letter_date", label: "Date of Letter", type: "date", required: true },
      { key: "firm_name", label: "Advisory Firm Name", type: "party", required: true },
      { key: "firm_address", label: "Firm Address", type: "text", required: true },
      { key: "client_name", label: "Client Name", type: "party", required: true },
      { key: "client_address", label: "Client Address", type: "text", required: true },
      { key: "client_gstin", label: "Client GSTIN", type: "text", required: true },
      { key: "retainer_scope", label: "Scope of Retainer", type: "longtext", required: true },
      { key: "monthly_retainer", label: "Monthly Retainer Fee", type: "amount", required: true },
      { key: "retainer_term", label: "Retainer Term", type: "text", required: true, hint: "e.g. 12 months, auto-renewable" },
      { key: "notice_days", label: "Termination Notice (days)", type: "number", required: true },
      { key: "governing_law_state", label: "Governing Law (State/UT)", type: "text", required: true },
    ],
    bodyHtml: `<h1>GST ADVISORY &amp; RETAINER ENGAGEMENT LETTER</h1>
<p>Date: {{letter_date}}</p>
<p>To,<br>The Management<br><strong>{{client_name}}</strong><br>{{client_address}}<br>GSTIN: {{client_gstin}}</p>
<p>Dear Sir/Madam,</p>
<p><strong>Subject: Engagement for Goods and Services Tax compliance and advisory services on a retainer basis</strong></p>
<p>We, <strong>{{firm_name}}</strong>, having our office at {{firm_address}}, are pleased to confirm the terms on which we will act as your GST advisers.</p>
<h2>1. Scope of Retainer</h2>
<p>Our retainer covers the following services under the CGST Act, 2017, the IGST Act, 2017, and the respective State GST Acts and Rules: {{retainer_scope}}. This includes, as applicable, preparation and filing of periodic returns (GSTR-1, GSTR-3B and annual return), reconciliation of input tax credit, and general advisory on GST matters.</p>
<h2>2. Client Responsibilities</h2>
<p>You shall provide complete, accurate and timely data, invoices and records. Responsibility for the correctness of underlying transactions, timely payment of tax, and maintenance of records rests with you. We rely on the information furnished and are not responsible for interest, late fees or penalties arising from delayed or incorrect data.</p>
<h2>3. Fees</h2>
<p>Our monthly retainer fee will be {{monthly_retainer}}, plus applicable Goods and Services Tax, payable monthly in advance. Representation before authorities, litigation, refunds, audits and one-off assignments shall be billed separately as mutually agreed. Tax shall be deducted at source under the Income-tax Act, 1961, as applicable.</p>
<h2>4. Term and Termination</h2>
<p>This engagement is for a term of {{retainer_term}}. Either party may terminate on {{notice_days}} days&rsquo; written notice, without prejudice to fees accrued up to the date of termination.</p>
<h2>5. Confidentiality</h2>
<p>We shall keep confidential all information received in the course of this engagement, subject to any disclosure required by law.</p>
<h2>6. Limitation of Liability</h2>
<p>Our liability shall be limited to the retainer fees received during the period to which the claim relates, save in cases of proven gross negligence or wilful default.</p>
<h2>7. Governing Law</h2>
<p>This engagement shall be governed by the laws of India, subject to the jurisdiction of the courts at {{governing_law_state}}.</p>
<p>Kindly sign and return the duplicate copy as a token of acceptance.</p>
<p>Yours faithfully,<br>For <strong>{{firm_name}}</strong></p>
<p><br>_____________________________<br>(Partner / Proprietor)</p>
<p><br><strong>Accepted for and on behalf of {{client_name}}</strong><br>_____________________________<br>(Authorised Signatory)</p>`,
  },

  // 9. Leave and License Agreement
  {
    id: "bt_leave_license",
    title: "Leave and License Agreement",
    category: "property",
    kind: "contract",
    description:
      "Leave and license agreement granting a licensee revocable permission to use residential or commercial premises.",
    variables: [
      { key: "execution_date", label: "Date of Execution", type: "date", required: true },
      { key: "licensor_name", label: "Licensor Name", type: "party", required: true },
      { key: "licensor_address", label: "Licensor Address", type: "text", required: true },
      { key: "licensee_name", label: "Licensee Name", type: "party", required: true },
      { key: "licensee_address", label: "Licensee Address", type: "text", required: true },
      { key: "premises_description", label: "Description of Premises", type: "longtext", required: true },
      { key: "usage_type", label: "Permitted Use", type: "text", required: true, hint: "e.g. residential / commercial office" },
      { key: "license_period_months", label: "License Period (months)", type: "number", required: true },
      { key: "monthly_license_fee", label: "Monthly License Fee", type: "amount", required: true },
      { key: "security_deposit", label: "Interest-Free Security Deposit", type: "amount", required: true },
      { key: "lock_in_months", label: "Lock-in Period (months)", type: "number", required: true },
      { key: "notice_months", label: "Termination Notice (months)", type: "number", required: true },
      { key: "governing_law_state", label: "Governing Law (State/UT)", type: "text", required: true },
      { key: "stamp_place", label: "Place of Execution", type: "text", required: true },
    ],
    bodyHtml: `<h1>LEAVE AND LICENSE AGREEMENT</h1>
<p>This Leave and License Agreement (the &ldquo;<strong>Agreement</strong>&rdquo;) is made on {{execution_date}} at {{stamp_place}}.</p>
<p><strong>BETWEEN</strong> <strong>{{licensor_name}}</strong>, residing at {{licensor_address}} (the &ldquo;Licensor&rdquo;); <strong>AND</strong> <strong>{{licensee_name}}</strong>, residing/having its office at {{licensee_address}} (the &ldquo;Licensee&rdquo;).</p>
<h2>1. Grant of License</h2>
<p>The Licensor, being lawfully entitled to the premises described below, grants to the Licensee a revocable licence to use and occupy the following premises (the &ldquo;Premises&rdquo;): {{premises_description}}. This Agreement creates a licence only and does not create any tenancy, lease, or any right, title or interest in the Premises in favour of the Licensee.</p>
<h2>2. Permitted Use</h2>
<p>The Premises shall be used solely for {{usage_type}} purposes, and for no other purpose, without the Licensor&rsquo;s prior written consent.</p>
<h2>3. Term and Lock-in</h2>
<p>The licence is granted for a period of {{license_period_months}} month(s) commencing from the date hereof. A lock-in period of {{lock_in_months}} month(s) shall apply, during which neither party shall terminate save for material breach.</p>
<h2>4. License Fee and Deposit</h2>
<ol>
<li>The Licensee shall pay a monthly licence fee of {{monthly_license_fee}}, payable in advance by the 5th day of each month.</li>
<li>The Licensee shall pay an interest-free refundable security deposit of {{security_deposit}}, refundable on vacating the Premises subject to deductions for dues and damage beyond normal wear and tear.</li>
<li>Electricity, water and other utility charges shall be borne by the Licensee as per actuals.</li>
</ol>
<h2>5. Maintenance and Alterations</h2>
<p>The Licensee shall keep the Premises in good condition and shall not carry out any structural alteration without the Licensor&rsquo;s written consent. The Licensor shall be responsible for major structural repairs.</p>
<h2>6. Termination</h2>
<p>After the lock-in period, either party may terminate this Agreement on {{notice_months}} month(s) written notice. On termination or expiry, the Licensee shall peacefully hand over vacant possession of the Premises.</p>
<h2>7. Registration and Stamp Duty</h2>
<p>This Agreement shall be stamped and registered as required under the applicable State Stamp Act and the Registration Act, 1908. Stamp duty and registration charges at {{stamp_place}} shall be borne as agreed by the parties.</p>
<h2>8. Governing Law and Dispute Resolution</h2>
<p>This Agreement shall be governed by the laws of India, and the courts at {{governing_law_state}} shall have jurisdiction. Disputes shall be referred to arbitration by a sole arbitrator under the Arbitration and Conciliation Act, 1996.</p>
<p><strong>IN WITNESS WHEREOF</strong> the parties have executed this Agreement on the date first written above.</p>
<p><br>_____________________________<br>{{licensor_name}} (Licensor)</p>
<p><br>_____________________________<br>{{licensee_name}} (Licensee)</p>
<p>Witnesses:<br>1. _____________________________<br>2. _____________________________</p>`,
  },

  // 10. Legal Notice (Cheque Dishonour under NI Act s.138)
  {
    id: "bt_legal_notice_138",
    title: "Legal Notice — Cheque Dishonour (NI Act s.138)",
    category: "notice",
    kind: "memo",
    description:
      "Statutory demand notice under Section 138 of the Negotiable Instruments Act following dishonour of a cheque.",
    variables: [
      { key: "notice_date", label: "Date of Notice", type: "date", required: true },
      { key: "advocate_name", label: "Advocate / Sender Name", type: "party", required: true },
      { key: "advocate_address", label: "Advocate / Sender Address", type: "text", required: true },
      { key: "client_name", label: "Client Name (on whose behalf)", type: "party", required: true },
      { key: "addressee_name", label: "Addressee (Drawer) Name", type: "party", required: true },
      { key: "addressee_address", label: "Addressee Address", type: "text", required: true },
      { key: "cheque_number", label: "Cheque Number", type: "text", required: true },
      { key: "cheque_date", label: "Cheque Date", type: "date", required: true },
      { key: "cheque_amount", label: "Cheque Amount", type: "amount", required: true },
      { key: "drawee_bank", label: "Drawee Bank and Branch", type: "text", required: true },
      { key: "underlying_liability", label: "Nature of Underlying Liability", type: "longtext", required: true },
      { key: "return_date", label: "Date of Cheque Return Memo", type: "date", required: true },
      { key: "return_reason", label: "Reason for Dishonour", type: "text", required: true, hint: "e.g. funds insufficient" },
    ],
    bodyHtml: `<h1>LEGAL NOTICE</h1>
<p><strong>Without Prejudice &mdash; By Registered Post A.D. and Email</strong></p>
<p>Date: {{notice_date}}</p>
<p>From:<br><strong>{{advocate_name}}</strong>, Advocate<br>{{advocate_address}}</p>
<p>To:<br><strong>{{addressee_name}}</strong><br>{{addressee_address}}</p>
<p>Dear Sir/Madam,</p>
<p><strong>Subject: Statutory notice of demand under Section 138 of the Negotiable Instruments Act, 1881, consequent upon dishonour of your cheque</strong></p>
<p>Under instructions from and on behalf of my client, <strong>{{client_name}}</strong> (the &ldquo;Client&rdquo;), I address you as follows:</p>
<ol>
<li>That you were liable to pay to my Client a sum on account of the following: {{underlying_liability}}.</li>
<li>That in discharge of the said legally enforceable debt/liability, you issued cheque bearing No. {{cheque_number}} dated {{cheque_date}} for a sum of {{cheque_amount}}, drawn on {{drawee_bank}}, in favour of my Client.</li>
<li>That on presentation of the said cheque, the same was returned unpaid vide the bank&rsquo;s return memo dated {{return_date}} with the remark &ldquo;{{return_reason}}&rdquo;.</li>
<li>That the dishonour of the said cheque constitutes an offence punishable under Section 138 of the Negotiable Instruments Act, 1881.</li>
</ol>
<p>I, therefore, through this notice, call upon you to pay to my Client the said sum of {{cheque_amount}} within fifteen (15) days of receipt of this notice, failing which my Client shall be constrained to initiate criminal proceedings under Section 138 of the Negotiable Instruments Act, 1881, before the competent court, and such other civil and criminal proceedings as available in law, entirely at your risk, cost and consequences.</p>
<p>A copy of this notice is retained in my office for record and future reference.</p>
<p>Yours faithfully,</p>
<p><br>_____________________________<br>{{advocate_name}}<br>Advocate<br>For and on behalf of {{client_name}}</p>`,
  },

  // 11. General Power of Attorney
  {
    id: "bt_general_poa",
    title: "General Power of Attorney",
    category: "property",
    kind: "contract",
    description:
      "General power of attorney by which a principal appoints an attorney to act on the principal's behalf.",
    variables: [
      { key: "execution_date", label: "Date of Execution", type: "date", required: true },
      { key: "principal_name", label: "Principal Name", type: "party", required: true },
      { key: "principal_address", label: "Principal Address", type: "text", required: true },
      { key: "attorney_name", label: "Attorney Name", type: "party", required: true },
      { key: "attorney_address", label: "Attorney Address", type: "text", required: true },
      { key: "relationship", label: "Relationship of Attorney to Principal", type: "text", required: true, hint: "e.g. son / brother / authorised representative" },
      { key: "powers_granted", label: "Powers Granted", type: "longtext", required: true },
      { key: "reason", label: "Reason for Executing POA", type: "longtext", required: true },
      { key: "governing_law_state", label: "Governing Law (State/UT)", type: "text", required: true },
      { key: "stamp_place", label: "Place of Execution", type: "text", required: true },
    ],
    bodyHtml: `<h1>GENERAL POWER OF ATTORNEY</h1>
<p>BY THIS GENERAL POWER OF ATTORNEY executed on {{execution_date}} at {{stamp_place}}:</p>
<p>I, <strong>{{principal_name}}</strong>, residing at {{principal_address}} (hereinafter the &ldquo;Principal&rdquo;), do hereby nominate, constitute and appoint <strong>{{attorney_name}}</strong>, residing at {{attorney_address}}, being my {{relationship}} (hereinafter the &ldquo;Attorney&rdquo;), to be my true and lawful attorney, to act for me and in my name.</p>
<h2>Reason</h2>
<p>WHEREAS, by reason of {{reason}}, I am unable to attend personally to the matters set out below and desire to appoint the Attorney to act on my behalf.</p>
<h2>Powers Granted</h2>
<p>NOW KNOW ALL MEN BY THESE PRESENTS that I hereby authorise the Attorney to do the following acts, deeds and things on my behalf: {{powers_granted}}</p>
<p>Without prejudice to the generality of the foregoing, the Attorney is empowered:</p>
<ol>
<li>To manage, administer and deal with my affairs and property, and to sign, execute and submit all applications, forms, returns, and documents to any authority, bank, or person.</li>
<li>To represent me before any government, statutory, judicial, quasi-judicial or revenue authority, and to appoint advocates or agents as necessary.</li>
<li>To operate bank accounts, receive and pay monies, and issue valid receipts and discharges on my behalf.</li>
<li>To do all such lawful acts as are necessary or incidental to the exercise of the powers granted herein.</li>
</ol>
<h2>Ratification</h2>
<p>I hereby agree to ratify and confirm all lawful acts done by the Attorney in exercise of the powers conferred, and declare that the same shall be binding on me as if done by me personally.</p>
<h2>Governing Law</h2>
<p>This Power of Attorney shall be governed by the laws of India, and the courts at {{governing_law_state}} shall have jurisdiction. This instrument shall be stamped and, where required, registered under the applicable State Stamp Act and the Registration Act, 1908.</p>
<p><strong>IN WITNESS WHEREOF</strong> I have signed this General Power of Attorney on the date first written above at {{stamp_place}}.</p>
<p><br>_____________________________<br>{{principal_name}} (Principal)</p>
<p>Accepted by:<br>_____________________________<br>{{attorney_name}} (Attorney)</p>
<p>Witnesses:<br>1. _____________________________<br>2. _____________________________</p>`,
  },

  // 12. Affidavit (General Verification)
  {
    id: "bt_affidavit_general",
    title: "Affidavit (General Verification)",
    category: "litigation",
    kind: "filing",
    description:
      "General-purpose affidavit sworn by a deponent verifying facts, for submission before a court or authority.",
    variables: [
      { key: "deponent_name", label: "Deponent Name", type: "party", required: true },
      { key: "parent_spouse_name", label: "Father's / Husband's Name", type: "text", required: true },
      { key: "deponent_age", label: "Deponent Age", type: "number", required: true },
      { key: "deponent_occupation", label: "Deponent Occupation", type: "text", required: true },
      { key: "deponent_address", label: "Deponent Address", type: "text", required: true },
      { key: "purpose", label: "Purpose of Affidavit", type: "text", required: true, hint: "e.g. for submission before the passport authority" },
      { key: "facts_deposed", label: "Facts Being Deposed", type: "longtext", required: true },
      { key: "place_of_verification", label: "Place of Verification", type: "text", required: true },
      { key: "verification_date", label: "Date of Verification", type: "date", required: true },
    ],
    bodyHtml: `<h1>AFFIDAVIT</h1>
<p>I, <strong>{{deponent_name}}</strong>, son/daughter/wife of {{parent_spouse_name}}, aged about {{deponent_age}} years, by occupation {{deponent_occupation}}, residing at {{deponent_address}}, do hereby solemnly affirm and sincerely state on oath as under:</p>
<ol>
<li>That I am the deponent herein and am fully conversant with the facts and circumstances stated in this affidavit and am competent to swear to the same.</li>
<li>That this affidavit is being made {{purpose}}.</li>
<li>That the facts deposed are as follows: {{facts_deposed}}</li>
<li>That the statements made hereinabove are true to my personal knowledge, and nothing material has been concealed or misstated therein.</li>
</ol>
<h2>VERIFICATION</h2>
<p>Verified at {{place_of_verification}} on this {{verification_date}} that the contents of the above affidavit are true and correct to my knowledge, that no part of it is false, and that nothing material has been concealed therefrom. Verified this day and signed below.</p>
<p><br>_____________________________<br><strong>{{deponent_name}}</strong><br>DEPONENT</p>
<p><br>Solemnly affirmed and signed before me by the deponent, who is identified to me, on the date and at the place aforesaid.</p>
<p><br>_____________________________<br>Notary Public / Oath Commissioner</p>`,
  },
];
