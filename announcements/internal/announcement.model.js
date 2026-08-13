import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    topic: {
      type: String,
      required: [true, 'Announcement topic is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Announcement description is required'],
      trim: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const AnnouncementModel = mongoose.model('Announcement', announcementSchema);