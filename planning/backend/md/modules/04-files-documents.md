# Module 04 — Files and Documents

## Purpose
Secure upload, storage, scanning and retrieval of files (`files`), plus the business concept of a **document** (`documents`): a typed, versioned file with a review status, attached to an owner (organization, request, order, purchase order, case, insurance record).

## Screens served
App: A06, A08 (replace document), SH09 Shipment documents, CU03/CU04 (upload or scan), CU07 Document review, PS2 Execution documents, S06 (sales documents), M05 (attach spec), R01/M10 (evidence), RC (photos, signature), POD, IN2/IN4, kit K-D02 Document vault and K-D03 Correct a document.
Dashboard: KYB document viewer, order documents tab, document audit.

## Files (storage layer)

**File**: `storage_key`, `bucket`, `mime`, `size_bytes`, `sha256`, `original_name`, `uploaded_by_user_id`, `purpose` (`DOCUMENT`|`EVIDENCE_PHOTO`|`SIGNATURE`|`PRODUCT_IMAGE`|`CHAT_ATTACHMENT`|`AVATAR`), `scan_status` (`PENDING`|`CLEAN`|`INFECTED`|`FAILED`), `width/height?`, `page_count?`.

Upload protocol:
1. `POST /files/upload-url { purpose, mime, sizeBytes, originalName }` validates the allow-list (PDF, JPG, PNG, HEIC, WEBP for images; max 10 MB, which matches the client "Max 10 MB • PDF, JPG, PNG") and returns `{ fileId, uploadUrl, headers, expiresAt }`.
2. The client `PUT`s the bytes directly to storage.
3. `POST /files/{fileId}/complete` → the server HEADs the object, checks size and hash, sniffs magic bytes, and enqueues the scan.
4. Scan job: ClamAV. Images are re-encoded (EXIF stripped, HEIC → JPEG) and get thumbnails (320px, 1024px). PDFs get a first-page thumbnail.
5. `scan_status = CLEAN` → the file can be attached. `INFECTED` → the object is deleted and the user notified ("File could not be accepted").

Download: `GET /files/{fileId}/download-url` → a 5-minute pre-signed URL after an **ownership check through the owning document/entity**. Files are never public except moderated product images (public bucket + CDN).

Evidence photos (POD, RC, stock intake, trip milestones) can also carry `captured_at` and `captured_location` metadata sent by the app, stored as structured fields.

## Documents (business layer)

**Document**: `owner_type` (`ORGANIZATION`|`SERVICE_REQUEST`|`ORDER`|`PURCHASE_ORDER`|`RETURN`|`CASE`|`INSURANCE_REQUEST`|`INSURANCE_CLAIM`|`VEHICLE`|`DRIVER`), `owner_id`, `document_type` (reference data), `custom_name?` (for `OTHER`, "Add and name a document"), `status`, `is_required`, `requested_by_org_id?` (broker-requested), `reviewer_scope` (`STAFF`|`BROKER`|`PROVIDER`), `current_version_id`, `rejection_reason?`, `reviewed_by?`, `reviewed_at?`, `expiry_date?`, `visibility` (who can see it: `OWNER`, `ASSIGNED_PROVIDER`, `ALL_PARTIES`, `STAFF_ONLY`).

**DocumentVersion**: `document_id`, `file_id`, `version_no`, `uploaded_by_user_id`, `uploaded_by_org_id`, `note?`, `created_at`. Versions are immutable, and replacing a document creates a new version.

Status machine: [04-state-machines.md §9](../04-state-machines.md#9-document-documentstatus).

### Checklists
When a request is submitted or an order confirmed, the service creates `MISSING` placeholder documents from `document-requirements` (reference data rules). The customer or provider then fills them. The checklist drives:
- CU03 (Bill of lading ✓ Uploaded, Commercial invoice ✓, Packing list ✓, Certificate of origin → Add file, SABER → As applicable)
- SH09 (Bill of lading Accepted • view file; Invoice & packing list Uploaded; Origin & SABER certificates As applicable)
- PS2 (Sea: B/L, container, seal; Air: AWB; Land: vehicle and border docs)

### Review
- Customs documents are reviewed by the assigned broker (PC1 "Accept or request changes per file", CU07).
- KYB documents are reviewed by staff.
- Freight execution documents uploaded by providers are visible to the customer, and no approval is needed unless flagged.
- A rejection needs a reason code + free text (e.g. "Quantity data not readable. Photograph the full page in clear light"). The customer sees it and can use K-D03 (crop/rotate/enhance client-side) to upload a replacement.
- *"Correction is conditional"*: only rejected documents enter the correction path.

### Visibility rules
- Before award, providers only see document **types** present on a request, not the files (D-16).
- After award, the assigned provider/broker sees order documents with `visibility ≥ ASSIGNED_PROVIDER`.
- Evidence (POD, RC photos) is visible to both parties and staff.
- Staff see everything, and access is audit-logged (document viewed event).

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/files/upload-url` | |
| POST | `/files/{id}/complete` | |
| GET | `/files/{id}/download-url` | Ownership enforced |
| GET | `/orders/{id}/documents` | Checklist + statuses (also `/service-requests/{id}/documents`, `/purchase-orders/{id}/documents`) |
| POST | `/orders/{id}/documents` | `{ documentType, customName?, fileId }` → new document or new version of a `MISSING`/`CHANGES_REQUESTED` one |
| POST | `/documents/{id}/versions` | Replace (new version) |
| POST | `/provider/orders/{id}/documents/{docId}/review` | `{ decision: ACCEPT \| REQUEST_CHANGES, reasonCode?, note? }` (broker/provider) |
| POST | `/provider/orders/{id}/document-requests` | Broker requests an additional document `{ documentType \| customName, note }` |
| GET | `/documents/{id}/history` | Versions + decisions |

Admin: `GET /admin/documents?ownerType&status&type`, `POST /admin/documents/{id}/review`, and document viewer URLs (audited).

## Events
`file.uploaded`, `file.scan_completed`, `document.uploaded`, `document.accepted`, `document.changes_requested`, `document.requested`, `document.expiring`, `document.expired`.

Consumers: notifications ("Document needs correction • Origin certificate • open order", X05), orders (start requirements met?), customs (all required accepted → ready to declare), KYB (item statuses).

## Retention
Order documents are kept for 10 years (proposal aligned with commercial record-keeping; confirm with legal). KYB documents are kept for the life of the account plus 5 years. Rejected versions are kept (audit). Chat attachments are kept for 2 years.

## Acceptance criteria
- [ ] Uploads above 10 MB or of disallowed types are rejected client- and server-side, with localized errors (X08 "Missing field or invalid file").
- [ ] An infected file never becomes downloadable.
- [ ] The broker can accept or reject each document with a reason, and the customer sees the reason and can replace it. Previous versions stay visible in history.
- [ ] Providers cannot download customer documents before award.
