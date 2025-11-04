// Central map of worksheet PDF links keyed by topicId (e.g., "1-H.1")
// Add or update entries here when you get new worksheet links.
// Only cards with a link present here will show the Download button.

export type WorksheetLinksMap = Record<string, string>;

export const worksheetLinks: WorksheetLinksMap = {
  // ReadKraft_1 — Grade 1
  "1-H.1": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_1-H.1.pdf?alt=media&token=5eda583b-03a8-4a40-ae87-823f4efff873", // Initial Consonant Blends
  "1-H.4": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_1-H.4.pdf?alt=media&token=d58614d2-0f4a-4955-8c93-980b4784d1d2", // Final Consonant Blends
  "1-I.3": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_1-I.3.pdf?alt=media&token=d6dbbb61-e664-4364-96c0-f2f544ab713e", // Fill in the short A word
  "1-T.2.1": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_1-T.2.1.pdf?alt=media&token=05c8cb33-94cc-4d6f-8ab0-fda2245a0993", // AR and OR sound words
  "1-T.2.2": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_1-T.2.2.pdf?alt=media&token=870028c9-e30c-4215-9b5f-9e82fee08a94", // ER / IR sound words
  "1-T.2.3": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_1-T.2.3.pdf?alt=media&token=fd1f181d-aa52-4e02-a272-f0b20162e456", // ER / IR / UR sound words

  // ReadKraft_2 — Grade 2
  "2-J.1": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_2-J.1.pdf?alt=media&token=f4fee9f8-95fa-47a3-992c-ee9999b4c3c0",
  "2-K.2": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_2-K.2.pdf?alt=media&token=ed9f45f4-77eb-42f7-aff6-27b1dbe83c30",
  "2-K.3": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_2-K.3.pdf?alt=media&token=2f65ee78-1890-41b0-9729-0b131bb79c40",
  "2-K.4": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_2-K.4.pdf?alt=media&token=e9950a28-1e8a-45d9-aaaf-cd51648f26cd",
  "2-K.5": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_2-K.5.pdf?alt=media&token=213aadfd-dbf8-4c1a-8a84-312ad55737b5",
  "2-K.6.1": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_2-K.6.1.pdf?alt=media&token=32fa7c2b-c24d-48fb-a0c9-e5bbf8621781",
  "2-K.6.2": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_2-K.6.2.pdf?alt=media&token=50062b8f-fc67-488f-8e0b-bf0acfbfad91",
  "2-L.2": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_2-L.2.pdf?alt=media&token=67cc9c98-18af-4ecf-903b-c61185036793",
  "2-L.3": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_2-L.3.pdf?alt=media&token=06cd601d-49e5-4cee-a63e-a98cce91ce97",
  "2-I.3": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_2-I.3.pdf?alt=media&token=e448eddd-1756-4812-8815-3a12706cc5db",
  "2-M.2.1": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_2-M.2.1.pdf?alt=media&token=ae4d21da-f8af-43df-8ede-0e2abe11e3fb",
  "2-M.2.2": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_2-M.2.2.pdf?alt=media&token=d41d032d-7bc0-45a6-a337-45cfe948efcc",
  "2-N.1": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_2-N.1.pdf?alt=media&token=8bee61fc-647e-415f-812c-43ece7f47d53",
  "2-P.2": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_2-P.2.pdf?alt=media&token=e6380886-b13e-4d60-9dd1-035e252fd2bf",
  "2-P.3": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_2-P.3.pdf?alt=media&token=3d3f456d-0f41-44f5-8c92-6709662035c7",
  "2-F.5": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_2-F.5.pdf?alt=media&token=56b8fa3f-f75a-474f-876f-0c2d2b8856ee",

  // ReadKraft_3 — Grade 3
  "3-A.3.1": "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/worksheets%2FReadKraft_3-A.3.1.pdf?alt=media&token=00a09ff7-3ed3-4dee-9424-d464c2862402",
};


