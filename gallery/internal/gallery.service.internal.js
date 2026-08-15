import mongoose from 'mongoose';
import { generateUploadSignature } from '../../shared/utils/cloudinary.js';
import { ValidationError, NotFoundError } from '../../shared/errors/index.js';
import { GalleryItemModel } from './gallery.model.js';

const ALLOWED_RESOURCE_TYPES = ['image', 'video', 'raw', 'auto', 'pdf'];

export const getUploadSignature = ({ folder, resource_type }) => {
  if (!folder || !resource_type) {
    throw new ValidationError('folder and resource_type are required query parameters.');
  }

  if (!ALLOWED_RESOURCE_TYPES.includes(resource_type)) {
    throw new ValidationError(
      `Invalid resource_type '${resource_type}'. Allowed types are: ${ALLOWED_RESOURCE_TYPES.join(', ')}.`
    );
  }

  const signed = generateUploadSignature({ folder });

  return {
    upload_url: `https://api.cloudinary.com/v1_1/${signed.cloudName}/${resource_type}/upload`,
    signature: signed.signature,
    timestamp: signed.timestamp,
    api_key: signed.apiKey,
    folder: signed.folder,
  };
};

export const createGalleryItem = async ({ data, userId }) => {
  const mediaUrl = data.url || data.media_url;
  const mediaType = data.type || data.media_type;
  const descriptionText = data.description !== undefined ? data.description : data.caption;

  if (!mediaUrl || typeof mediaUrl !== 'string' || !mediaUrl.trim()) {
    throw new ValidationError('media_url / url is required.');
  }

  if (!mediaType || !['image', 'video', 'pdf'].includes(mediaType)) {
    throw new ValidationError("media_type / type is required and must be 'image', 'video', or 'pdf'.");
  }

  if (!data.collection_name || typeof data.collection_name !== 'string' || !data.collection_name.trim()) {
    throw new ValidationError('collection_name is required.');
  }

  const now = new Date();
  const item = await GalleryItemModel.create({
    title: data.title || '',
    caption: descriptionText || '',
    description: descriptionText || '',
    media_url: mediaUrl.trim(),
    cover_image: data.cover_image || data.coverImage || '',
    media_type: mediaType,
    collection_name: data.collection_name.trim(),
    auditing: {
      created_by: userId,
      created_at: now,
      updated_by: userId,
      updated_at: now,
    },
  });

  return item.toJSON();
};

export const bulkCreateGalleryItems = async ({ collection_name, items, userId }) => {
  if (!collection_name || typeof collection_name !== 'string' || !collection_name.trim()) {
    throw new ValidationError('collection_name is required.');
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError('items must be a non-empty array of media objects.');
  }

  const trimmedCollection = collection_name.trim();
  const now = new Date();
  const docsToInsert = [];

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const mediaUrl = item.url || item.media_url;
    const mediaType = item.type || item.media_type;
    const descriptionText = item.description !== undefined ? item.description : item.caption;

    if (!mediaUrl || typeof mediaUrl !== 'string' || !mediaUrl.trim()) {
      throw new ValidationError(`Item at index ${idx} is missing a valid media_url / url.`);
    }

    if (!mediaType || !['image', 'video', 'pdf'].includes(mediaType)) {
      throw new ValidationError(`Item at index ${idx} must have media_type 'image', 'video', or 'pdf'.`);
    }

    docsToInsert.push({
      title: item.title || '',
      caption: descriptionText || '',
      description: descriptionText || '',
      media_url: mediaUrl.trim(),
      cover_image: item.cover_image || item.coverImage || '',
      media_type: mediaType,
      collection_name: trimmedCollection,
      auditing: {
        created_by: userId,
        created_at: now,
        updated_by: userId,
        updated_at: now,
      },
    });
  }

  const createdDocs = await GalleryItemModel.insertMany(docsToInsert);
  return createdDocs.map((doc) => doc.toJSON());
};

export const getShowcase = async () => {
  const items = await GalleryItemModel.find().sort({ 'auditing.created_at': -1 });

  const collectionsMap = new Map();

  for (const doc of items) {
    const itemJSON = doc.toJSON();
    const colName = itemJSON.collection_name;

    if (!collectionsMap.has(colName)) {
      collectionsMap.set(colName, {
        collection_name: colName,
        total_items: 0,
        photos_count: 0,
        videos_count: 0,
        pdfs_count: 0,
        cover_image: itemJSON.cover_image || itemJSON.url || itemJSON.media_url || '',
        items: [],
      });
    }

    const colGroup = collectionsMap.get(colName);
    colGroup.total_items += 1;
    if (itemJSON.media_type === 'image') {
      colGroup.photos_count += 1;
    } else if (itemJSON.media_type === 'video') {
      colGroup.videos_count += 1;
    } else if (itemJSON.media_type === 'pdf') {
      colGroup.pdfs_count += 1;
    }
    colGroup.items.push(itemJSON);
  }

  return {
    collections: Array.from(collectionsMap.values()),
  };
};

export const getCollectionByName = async ({ collection_name }) => {
  if (!collection_name || typeof collection_name !== 'string' || !collection_name.trim()) {
    throw new ValidationError('collection_name parameter is required.');
  }

  const trimmedName = collection_name.trim();
  const items = await GalleryItemModel.find({
    collection_name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
  }).sort({ 'auditing.created_at': -1 });

  if (!items || items.length === 0) {
    throw new NotFoundError(`Collection with name '${collection_name}' not found.`);
  }

  const itemJSONs = items.map((doc) => doc.toJSON());
  const actualName = itemJSONs[0].collection_name;
  let photosCount = 0;
  let videosCount = 0;
  let pdfsCount = 0;

  for (const item of itemJSONs) {
    if (item.media_type === 'image') photosCount++;
    if (item.media_type === 'video') videosCount++;
    if (item.media_type === 'pdf') pdfsCount++;
  }

  return {
    collection_name: actualName,
    total_items: itemJSONs.length,
    photos_count: photosCount,
    videos_count: videosCount,
    pdfs_count: pdfsCount,
    items: itemJSONs,
  };
};

export const listCollections = async () => {
  const items = await GalleryItemModel.find().sort({ 'auditing.created_at': -1 });

  const collectionsMap = new Map();

  for (const doc of items) {
    const itemJSON = doc.toJSON();
    const colName = itemJSON.collection_name;

    if (!collectionsMap.has(colName)) {
      collectionsMap.set(colName, {
        collection_name: colName,
        total_items: 0,
        photos_count: 0,
        videos_count: 0,
        pdfs_count: 0,
        cover_url: itemJSON.cover_image || itemJSON.media_url,
      });
    }

    const colGroup = collectionsMap.get(colName);
    colGroup.total_items += 1;
    if (itemJSON.media_type === 'image') {
      colGroup.photos_count += 1;
    } else if (itemJSON.media_type === 'video') {
      colGroup.videos_count += 1;
    } else if (itemJSON.media_type === 'pdf') {
      colGroup.pdfs_count += 1;
    }
  }

  return {
    collections: Array.from(collectionsMap.values()),
  };
};

export const renameCollection = async ({ collection_name, new_collection_name, userId }) => {
  if (!collection_name || typeof collection_name !== 'string' || !collection_name.trim()) {
    throw new ValidationError('collection_name parameter is required.');
  }

  if (!new_collection_name || typeof new_collection_name !== 'string' || !new_collection_name.trim()) {
    throw new ValidationError('new_collection_name parameter is required.');
  }

  const oldName = collection_name.trim();
  const newName = new_collection_name.trim();

  const matchingItems = await GalleryItemModel.find({
    collection_name: { $regex: new RegExp(`^${oldName}$`, 'i') },
  });

  if (!matchingItems || matchingItems.length === 0) {
    throw new NotFoundError(`No collection found with name '${collection_name}'.`);
  }

  const now = new Date();
  await GalleryItemModel.updateMany(
    { collection_name: { $regex: new RegExp(`^${oldName}$`, 'i') } },
    {
      $set: {
        collection_name: newName,
        'auditing.updated_by': userId,
        'auditing.updated_at': now,
      },
    }
  );

  return {
    message: `Collection successfully renamed from '${oldName}' to '${newName}'.`,
    old_collection_name: oldName,
    new_collection_name: newName,
    items_updated: matchingItems.length,
  };
};

export const listGalleryItems = async (query = {}) => {
  const filter = {};

  if (query.collection_name) {
    filter.collection_name = { $regex: new RegExp(`^${query.collection_name.trim()}$`, 'i') };
  }

  if (query.media_type || query.type) {
    const typeVal = query.media_type || query.type;
    if (!['image', 'video', 'pdf'].includes(typeVal)) {
      throw new ValidationError("media_type / type must be 'image', 'video', or 'pdf'.");
    }
    filter.media_type = typeVal;
  }

  const items = await GalleryItemModel.find(filter).sort({ 'auditing.created_at': -1 });
  return items.map((item) => item.toJSON());
};

export const getGalleryItemById = async ({ id }) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('Invalid gallery item ID.');
  }

  const item = await GalleryItemModel.findById(id);
  if (!item) {
    throw new NotFoundError(`Gallery item with ID '${id}' not found.`);
  }

  return item.toJSON();
};

export const updateGalleryItem = async ({ id, data, userId }) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('Invalid gallery item ID.');
  }

  const item = await GalleryItemModel.findById(id);
  if (!item) {
    throw new NotFoundError(`Gallery item with ID '${id}' not found.`);
  }

  if (data.title !== undefined) {
    item.title = data.title;
  }
  if (data.caption !== undefined || data.description !== undefined) {
    const descText = data.description !== undefined ? data.description : data.caption;
    item.caption = descText;
    item.description = descText;
  }
  if (data.media_url !== undefined || data.url !== undefined) {
    const urlVal = data.url !== undefined ? data.url : data.media_url;
    if (typeof urlVal !== 'string' || !urlVal.trim()) {
      throw new ValidationError('media_url / url cannot be empty.');
    }
    item.media_url = urlVal.trim();
  }
  if (data.cover_image !== undefined || data.coverImage !== undefined) {
    item.cover_image = data.cover_image !== undefined ? data.cover_image : data.coverImage;
  }
  if (data.media_type !== undefined || data.type !== undefined) {
    const typeVal = data.type !== undefined ? data.type : data.media_type;
    if (!['image', 'video', 'pdf'].includes(typeVal)) {
      throw new ValidationError("media_type / type must be 'image', 'video', or 'pdf'.");
    }
    item.media_type = typeVal;
  }
  if (data.collection_name !== undefined) {
    if (typeof data.collection_name !== 'string' || !data.collection_name.trim()) {
      throw new ValidationError('collection_name cannot be empty.');
    }
    item.collection_name = data.collection_name.trim();
  }

  item.auditing.updated_by = userId;
  item.auditing.updated_at = new Date();

  await item.save();
  return item.toJSON();
};

export const deleteGalleryItem = async ({ id }) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('Invalid gallery item ID.');
  }

  const item = await GalleryItemModel.findByIdAndDelete(id);
  if (!item) {
    throw new NotFoundError(`Gallery item with ID '${id}' not found.`);
  }

  return {
    message: 'Gallery item successfully deleted.',
  };
};
