// import { Document } from "@/models/Document";
// import { RequestError } from "@/lib/http";

// export function normalizeDocumentTitle(title: string) {
//   return title.trim();
// }

// export async function assertDocumentTitleAvailable(options: {
//   ownerId: string;
//   title: string;
//   excludeDocumentId?: string;
// }) {
//   const query: {
//     ownerId: string;
//     title: string;
//     _id?: { $ne: string };
//   } = {
//     ownerId: options.ownerId,
//     title: options.title
//   };

//   if (options.excludeDocumentId) {
//     query._id = { $ne: options.excludeDocumentId };
//   }

//   const existingDocument = await Document.findOne(query).select("_id").lean();

//   if (existingDocument) {
//     throw new RequestError("A document with this title already exists", 409);
//   }
// }
import { Document } from "@/models/Document";

export function normalizeDocumentTitle(title: string) {
  return title.trim();
}

export async function generateUniqueDocumentTitle(options: {
  ownerId: string;
  title: string;
  excludeDocumentId?: string;
}) {
  const baseTitle = options.title.trim();

  const query: any = {
    ownerId: options.ownerId,
  };

  if (options.excludeDocumentId) {
    query._id = { $ne: options.excludeDocumentId };
  }

  const existingDocuments = await Document.find(query)
    .select("title")
    .lean();

  const existingTitles = new Set(
    existingDocuments.map((doc) => doc.title)
  );

  // If title doesn't exist, use it directly
  if (!existingTitles.has(baseTitle)) {
    return baseTitle;
  }

  // Find next available suffix
  let counter = 1;

  while (
    existingTitles.has(
      `${baseTitle}${String(counter).padStart(2, "0")}`
    )
  ) {
    counter++;
  }

  return `${baseTitle}${String(counter).padStart(2, "0")}`;
}