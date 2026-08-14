import mongoose from 'mongoose';
import { generateUploadSignature } from '../../shared/utils/cloudinary.js';
import { ValidationError, NotFoundError } from '../../shared/errors/index.js';
import { GalleryItemModel } from './gallery.model.js';

const ALLOWED_RESOURCE_TYPES = ['image', 'video', 'raw', 'auto'];

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
  if (!data.media_url || typeof data.media_url !== 'string' || !data.media_url.trim()) {
    throw new ValidationError('media_url is required.');
  }

  if (!data.media_type || !['image', 'video'].includes(data.media_type)) {
    throw new ValidationError("media_type is required and must be either 'image' or 'video'.");
  }

  if (!data.collection_name || typeof data.collection_name !== 'string' || !data.collection_name.trim()) {
    throw new ValidationError('collection_name is required.');
  }

  const now = new Date();
  const item = await GalleryItemModel.create({
    title: data.title || '',
    caption: data.caption || '',
    media_url: data.media_url.trim(),
    media_type: data.media_type,
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
    if (!item.media_url || typeof item.media_url !== 'string' || !item.media_url.trim()) {
      throw new ValidationError(`Item at index ${idx} is missing a valid media_url.`);
    }

    if (!item.media_type || !['image', 'video'].includes(item.media_type)) {
      throw new ValidationError(`Item at index ${idx} must have media_type 'image' or 'video'.`);
    }

    docsToInsert.push({
      title: item.title || '',
      caption: item.caption || '',
      media_url: item.media_url.trim(),
      media_type: item.media_type,
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
        items: [],
      });
    }

    const colGroup = collectionsMap.get(colName);
    colGroup.total_items += 1;
    if (itemJSON.media_type === 'image') {
      colGroup.photos_count += 1;
    } else if (itemJSON.media_type === 'video') {
      colGroup.videos_count += 1;
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

  for (const item of itemJSONs) {
    if (item.media_type === 'image') photosCount++;
    if (item.media_type === 'video') videosCount++;
  }

  return {
    collection_name: actualName,
    total_items: itemJSONs.length,
    photos_count: photosCount,
    videos_count: videosCount,
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
        cover_url: itemJSON.media_url,
      });
    }

    const colGroup = collectionsMap.get(colName);
    colGroup.total_items += 1;
    if (itemJSON.media_type === 'image') {
      colGroup.photos_count += 1;
    } else if (itemJSON.media_type === 'video') {
      colGroup.videos_count += 1;
    }
  }

  return {
    collections: Array.from(collectionsMap.values()),
  };
};

export const listGalleryItems = async (query = {}) => {
  const filter = {};

  if (query.collection_name) {
    filter.collection_name = { $regex: new RegExp(`^${query.collection_name.trim()}$`, 'i') };
  }

  if (query.media_type) {
    if (!['image', 'video'].includes(query.media_type)) {
      throw new ValidationError("media_type must be either 'image' or 'video'.");
    }
    filter.media_type = query.media_type;
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
  if (data.caption !== undefined) {
    item.caption = data.caption;
  }
  if (data.media_url !== undefined) {
    if (typeof data.media_url !== 'string' || !data.media_url.trim()) {
      throw new ValidationError('media_url cannot be empty.');
    }
    item.media_url = data.media_url.trim();
  }
  if (data.media_type !== undefined) {
    if (!['image', 'video'].includes(data.media_type)) {
      throw new ValidationError("media_type must be either 'image' or 'video'.");
    }
    item.media_type = data.media_type;
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
