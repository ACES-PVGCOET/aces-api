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
  },
);

const eventSchema = new mongoose.Schema(
  {
    overview: {
      type: String,
      required: [true, 'Event overview is required'],
      trim: true,
    },

    description: {
      type: String,
      required: [true, 'Event description is required'],
      trim: true,
    },

    terms: {
      type: String,
      required: [true, 'Event terms are required'],
      trim: true,
    },

    reg_form_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Form',
      default: null,
    },

    banner_url: {
      type: String,
      trim: true,
      default: '',
    },

    reg_st_dt: {
      type: Date,
      default: null,
    },

    reg_end_dt: {
      type: Date,
      default: null,
    },

    isHighlight: {
      type: Boolean,
      default: false,
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
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const EventModel = mongoose.model('Event', eventSchema);