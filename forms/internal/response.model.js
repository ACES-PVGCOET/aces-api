import mongoose from 'mongoose';

const responseSchema = new mongoose.Schema(
  {
    form_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Form',
      required: true,
      index: true,
    },
    member_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      default: null,
      index: true,
    },
    answers: {
      type: Map,
      of: [String],
      required: true,
    },
    submitted_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.response_id = ret._id;
        delete ret._id;
        delete ret.__v;
        if (ret.answers && typeof ret.answers.toObject === 'function') {
          ret.answers = ret.answers.toObject();
        } else if (ret.answers instanceof Map) {
          ret.answers = Object.fromEntries(ret.answers);
        }
        return ret;
      },
    },
  }
);

export const FormResponse = mongoose.model('FormResponse', responseSchema);
