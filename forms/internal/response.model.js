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
    email: {
      type: String,
      required: [true, 'Form filler email is required'],
      trim: true,
      lowercase: true,
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

// Non-unique compound index to optimize queries while allowing multiple responses when configured on the form
responseSchema.index({ form_id: 1, email: 1 });

export const FormResponse = mongoose.model('FormResponse', responseSchema);

// If an older unique index exists on an existing database, ensure it is safely replaced with non-unique index
if (FormResponse && typeof FormResponse.init === 'function') {
  FormResponse.init()
    .then(async () => {
      try {
        if (FormResponse.collection) {
          const indexes = await FormResponse.collection.indexes();
          const oldUniqueIndex = indexes.find(
            (idx) => idx.name === 'form_id_1_email_1' && idx.unique
          );
          if (oldUniqueIndex) {
            await FormResponse.collection.dropIndex('form_id_1_email_1');
            await FormResponse.collection.createIndex({ form_id: 1, email: 1 });
          }
        }
      } catch (_e) {
        // Ignore background index sync errors
      }
    })
    .catch(() => {});
}
