import mongoose from 'mongoose';
import { ROLES, MEMBER_STATUS } from '../../shared/constants/index.js';

const memberSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Member email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      select: false,
    },
    team: {
      type: String,
      required: [true, 'Team affiliation is required'],
      trim: true,
    },
    position: {
      type: String,
      default: 'member',
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(MEMBER_STATUS),
      default: MEMBER_STATUS.NOT_ACTIVE,
    },
    roles: {
      type: [String],
      enum: Object.values(ROLES),
    },
    profile_photo_url: {
      type: String,
      default: '',
    },
    onboarding_token: {
      type: String,
      select: false,
    },
    onboarding_token_expires_at: {
      type: Date,
      select: false,
    },
    social_links: {
      linkedin: { type: String, default: '' },
      instagram: { type: String, default: '' },
      github: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.onboarding_token;
        delete ret.onboarding_token_expires_at;
        return ret;
      },
    },
  }
);

export const MemberModel = mongoose.model('Member', memberSchema);

