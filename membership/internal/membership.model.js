import mongoose from 'mongoose';

export const MEMBERSHIP_STATUS = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
};

export const PAYMENT_MODES = {
  UPI: 'UPI',
  CASH: 'CASH',
  OTHER: 'OTHER',
};

export const RECEIPT_STATUS = {
  NOT_SENT: 'NOT_SENT',
  QUEUED: 'QUEUED',
  SENT: 'SENT',
};

const membershipSchema = new mongoose.Schema(
  {
    full_name: {
      type: String,
      required: [true, 'Student full name is required'],
      trim: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    class_name: {
      type: String,
      required: [true, 'Class name is required (e.g. SE, TE, BE)'],
      trim: true,
      uppercase: true,
      index: true,
    },
    contact_number: {
      type: String,
      trim: true,
      index: true,
      default: '',
    },
    payment_mode: {
      type: String,
      default: 'UPI',
      trim: true,
      uppercase: true,
    },
    payment_date: {
      type: String,
      default: '',
      trim: true,
    },
    amount: {
      type: Number,
      default: 450,
    },
    transaction_ss_url: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(MEMBERSHIP_STATUS),
      default: MEMBERSHIP_STATUS.PENDING,
      index: true,
    },
    verified_by: {
      type: String,
      default: '',
    },
    verified_by_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      default: null,
    },
    verified_at: {
      type: Date,
      default: null,
    },
    receipt_number: {
      type: String,
      default: '',
      trim: true,
    },
    receipt_status: {
      type: String,
      enum: Object.values(RECEIPT_STATUS),
      default: RECEIPT_STATUS.NOT_SENT,
    },
    remarks: {
      type: String,
      default: '',
      trim: true,
    },
    registration_timestamp: {
      type: String,
      default: '',
    },
    source: {
      type: String,
      default: 'google_form_sheet',
    },
  },
  {
    timestamps: true,
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

membershipSchema.index({ email: 1 });
membershipSchema.index({ contact_number: 1, full_name: 1 });

export const MembershipModel = mongoose.model('Membership', membershipSchema);

const membershipSyncMetaSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'membership_form_sync',
      index: true,
    },
    form_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Form',
      default: null,
      index: true,
    },
    lastMembershipSynced: {
      type: Date,
      default: null,
    },
    last_synced_at: {
      type: Date,
      default: null,
    },
    synced_count: {
      type: Number,
      default: 0,
    },
    ignored_count: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
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

export const MembershipSyncMetaModel = mongoose.model('MembershipSyncMeta', membershipSyncMetaSchema);

