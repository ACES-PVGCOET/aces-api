import mongoose from 'mongoose';

const formSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Form title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    question_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
      },
    ],
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.form_id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Form = mongoose.model('Form', formSchema);
