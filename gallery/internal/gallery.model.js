import mongoose from 'mongoose';

const auditingSchema = new mongoose.Schema(
  {
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
    },
    created_at: {
      type: Date,
      required: true,
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
    },
    updated_at: {
      type: Date,
      required: true,
    },
  },
  {
    _id: false,
  }
);

const galleryItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      default: '',
    },
    caption: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    media_url: {
      type: String,
      required: [true, 'Media URL is required'],
      trim: true,
    },
    cover_image: {
      type: String,
      trim: true,
      default: '',
    },
    media_type: {
      type: String,
      required: [true, 'Media type is required'],
      enum: {
        values: ['image', 'video', 'pdf'],
        message: "Media type must be 'image', 'video', or 'pdf'",
      },
      trim: true,
    },
    collection_name: {
      type: String,
      required: [true, 'Collection name is required'],
      trim: true,
      index: true,
    },
    auditing: {
      type: auditingSchema,
      required: true,
    },
  },
  {
    timestamps: false,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.url = ret.media_url;
        ret.type = ret.media_type;
        ret.description = ret.description || ret.caption || '';
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

galleryItemSchema.index({ collection_name: 1, 'auditing.created_at': -1 });

export const GalleryItemModel = mongoose.model('GalleryItem', galleryItemSchema);
