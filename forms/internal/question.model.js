import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    form_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Form',
      required: true,
      index: true,
    },
    question_serial: {
      type: Number,
      required: true,
    },
    question_statement: {
      type: String,
      required: [true, 'Question statement is required'],
      trim: true,
    },
    question_type: {
      type: String,
      required: true,
      enum: ['textual', 'multiple_choice', 'file'],
    },
    is_required: {
      type: Boolean,
      default: true,
    },
    image_url: {
      type: String,
      trim: true,
      default: '',
    },
    textual_policy: {
      max_len: {
        type: Number,
        default: 500,
      },
    },
    multiple_choice_policy: {
      type: {
        type: String,
        enum: ['Single', 'Multiple'],
        default: 'Single',
      },
      options: [
        {
          type: String,
          trim: true,
        },
      ],
    },
    file_policy: {
      supported_types: [
        {
          type: String,
          trim: true,
        },
      ],
      max_size_mb: {
        type: Number,
        default: 5,
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.question_id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

questionSchema.index({ form_id: 1, question_serial: 1 }, { unique: true });

export const Question = mongoose.model('Question', questionSchema);
