import mongoose from 'mongoose';
import { Form } from './form.model.js';
import { Question } from './question.model.js';
import { FormResponse } from './response.model.js';
import { ValidationError, NotFoundError } from '../../shared/errors/index.js';

export class FormsInternalService {
  /**
   * Create a new form along with its structured questions
   */
  static async createForm({ title, description, questions = [], created_by }) {
    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new ValidationError('Form title is required.');
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new ValidationError('At least one question is required to create a form.');
    }

    // 1. Create Form Shell
    const form = await Form.create({
      title: title.trim(),
      description: description ? description.trim() : '',
      created_by,
    });

    try {
      // 2. Validate & Prepare Questions
      const questionDocs = [];
      const serialSet = new Set();

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const serial = q.question_serial || i + 1;

        if (serialSet.has(serial)) {
          throw new ValidationError(`Duplicate question_serial ${serial} provided.`);
        }
        serialSet.add(serial);

        if (!q.question_statement || typeof q.question_statement !== 'string') {
          throw new ValidationError(`Question statement is required for serial ${serial}.`);
        }

        if (!['textual', 'multiple_choice', 'file'].includes(q.question_type)) {
          throw new ValidationError(`Invalid question_type '${q.question_type}' for serial ${serial}.`);
        }

        questionDocs.push({
          form_id: form._id,
          question_serial: serial,
          question_statement: q.question_statement.trim(),
          question_type: q.question_type,
          is_required: q.is_required !== undefined ? Boolean(q.is_required) : true,
          textual_policy: {
            max_len: (q.textual_policy && q.textual_policy.max_len) || 500,
          },
          multiple_choice_policy: {
            type: (q.multiple_choice_policy && q.multiple_choice_policy.type) || 'Single',
            options: (q.multiple_choice_policy && q.multiple_choice_policy.options) || [],
          },
          file_policy: {
            supported_types: (q.file_policy && q.file_policy.supported_types) || [],
            max_size_mb: (q.file_policy && q.file_policy.max_size_mb) || 5,
          },
        });
      }

      // 3. Insert Question Documents
      const createdQuestions = await Question.create(questionDocs);
      const questionIds = createdQuestions.map((q) => q._id);

      // 4. Update Form with Question IDs
      form.question_ids = questionIds;
      await form.save();

      return {
        form_id: form._id,
        title: form.title,
        description: form.description,
        question_count: createdQuestions.length,
        created_at: form.createdAt,
      };
    } catch (error) {
      await Form.findByIdAndDelete(form._id);
      await Question.deleteMany({ form_id: form._id });
      throw error;
    }
  }

  /**
   * Get form details with populated questions
   */
  static async getFormById(form_id) {
    if (!mongoose.Types.ObjectId.isValid(form_id)) {
      throw new ValidationError('Invalid form ID format.');
    }

    const form = await Form.findById(form_id).lean();
    if (!form) {
      throw new NotFoundError('Form not found.');
    }

    const questions = await Question.find({ form_id }).sort({ question_serial: 1 }).lean();

    const formattedQuestions = questions.map((q) => ({
      question_id: q._id,
      question_serial: q.question_serial,
      question_statement: q.question_statement,
      question_type: q.question_type,
      is_required: q.is_required,
      textual_policy: q.textual_policy,
      multiple_choice_policy: q.multiple_choice_policy,
      file_policy: q.file_policy,
    }));

    return {
      form_id: form._id,
      title: form.title,
      description: form.description,
      is_active: form.is_active,
      questions: formattedQuestions,
      created_at: form.createdAt,
      updated_at: form.updatedAt,
    };
  }

  /**
   * Get paginated list of forms
   */
  static async getForms({ page = 1, limit = 10, is_active } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (is_active !== undefined) {
      filter.is_active = is_active === 'true' || is_active === true;
    }

    const [forms, total] = await Promise.all([
      Form.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Form.countDocuments(filter),
    ]);

    const formattedForms = forms.map((f) => ({
      form_id: f._id,
      title: f.title,
      description: f.description,
      is_active: f.is_active,
      question_count: f.question_ids ? f.question_ids.length : 0,
      created_at: f.createdAt,
    }));

    return {
      forms: formattedForms,
      total,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(total / limitNum),
    };
  }

  /**
   * Update existing form details and questions
   */
  static async updateForm(form_id, updateData, updated_by) {
    if (!mongoose.Types.ObjectId.isValid(form_id)) {
      throw new ValidationError('Invalid form ID format.');
    }

    const form = await Form.findById(form_id);
    if (!form) {
      throw new NotFoundError('Form not found.');
    }

    if (updateData.title !== undefined) {
      if (!updateData.title || !updateData.title.trim()) {
        throw new ValidationError('Form title cannot be empty.');
      }
      form.title = updateData.title.trim();
    }

    if (updateData.description !== undefined) {
      form.description = updateData.description.trim();
    }

    if (updateData.is_active !== undefined) {
      form.is_active = Boolean(updateData.is_active);
    }

    form.updated_by = updated_by;

    // If new questions array is provided, replace questions
    if (Array.isArray(updateData.questions)) {
      await Question.deleteMany({ form_id });
      const questionDocs = updateData.questions.map((q, idx) => ({
        form_id: form._id,
        question_serial: q.question_serial || idx + 1,
        question_statement: q.question_statement.trim(),
        question_type: q.question_type,
        is_required: q.is_required !== undefined ? Boolean(q.is_required) : true,
        textual_policy: q.textual_policy || { max_len: 500 },
        multiple_choice_policy: q.multiple_choice_policy || { type: 'Single', options: [] },
        file_policy: q.file_policy || { supported_types: [], max_size_mb: 5 },
      }));

      const createdQuestions = await Question.create(questionDocs);
      form.question_ids = createdQuestions.map((q) => q._id);
    }

    await form.save();
    return this.getFormById(form_id);
  }

  /**
   * Delete form and associated questions & responses
   */
  static async deleteForm(form_id) {
    if (!mongoose.Types.ObjectId.isValid(form_id)) {
      throw new ValidationError('Invalid form ID format.');
    }

    const form = await Form.findByIdAndDelete(form_id);
    if (!form) {
      throw new NotFoundError('Form not found.');
    }

    await Promise.all([
      Question.deleteMany({ form_id }),
      FormResponse.deleteMany({ form_id }),
    ]);

    return { form_id, message: 'Form and all associated data deleted successfully.' };
  }

  /**
   * Submit response to a form with strict question policy enforcement
   */
  static async submitResponse(form_id, member_id, answersInput) {
    if (!mongoose.Types.ObjectId.isValid(form_id)) {
      throw new ValidationError('Invalid form ID format.');
    }

    const form = await Form.findById(form_id);
    if (!form) {
      throw new NotFoundError('Form not found.');
    }

    if (!form.is_active) {
      throw new ValidationError('Form is closed and no longer accepting responses.');
    }

    if (!answersInput || typeof answersInput !== 'object') {
      throw new ValidationError('Answers object is required.');
    }

    const questions = await Question.find({ form_id }).sort({ question_serial: 1 }).lean();
    const questionMapBySerial = new Map();
    questions.forEach((q) => {
      questionMapBySerial.set(String(q.question_serial), q);
    });

    const normalizedAnswers = new Map();

    // Iterate through defined questions and validate submitted answers
    for (const question of questions) {
      const serialKey = String(question.question_serial);
      const rawAnswer = answersInput[serialKey] !== undefined ? answersInput[serialKey] : answersInput[question.question_serial];

      let answerArray = [];
      if (Array.isArray(rawAnswer)) {
        answerArray = rawAnswer.map((val) => String(val).trim()).filter((val) => val.length > 0);
      } else if (rawAnswer !== undefined && rawAnswer !== null && String(rawAnswer).trim() !== '') {
        answerArray = [String(rawAnswer).trim()];
      }

      // Check required condition
      if (question.is_required && answerArray.length === 0) {
        throw new ValidationError(`Question serial ${question.question_serial} is required.`);
      }

      if (answerArray.length > 0) {
        // Validate by question type policies
        if (question.question_type === 'textual') {
          const maxLen = (question.textual_policy && question.textual_policy.max_len) || 500;
          const fullText = answerArray.join(' ');
          if (fullText.length > maxLen) {
            throw new ValidationError(
              `Question serial ${question.question_serial} exceeds maximum length constraint of ${maxLen} characters.`
            );
          }
        } else if (question.question_type === 'multiple_choice') {
          const policy = question.multiple_choice_policy || {};
          const options = policy.options || [];

          if (policy.type === 'Single' && answerArray.length > 1) {
            throw new ValidationError(
              `Question serial ${question.question_serial} allows only a single choice.`
            );
          }

          for (const selected of answerArray) {
            if (options.length > 0 && !options.includes(selected)) {
              throw new ValidationError(
                `Invalid option '${selected}' selected for question serial ${question.question_serial}. Allowed options: [${options.join(', ')}].`
              );
            }
          }
        } else if (question.question_type === 'file') {
          const policy = question.file_policy || {};
          const supportedTypes = policy.supported_types || [];

          if (supportedTypes.length > 0) {
            for (const fileUrl of answerArray) {
              const extension = fileUrl.split('.').pop().toLowerCase();
              const isValidType = supportedTypes.some(
                (type) => type.toLowerCase() === extension || fileUrl.includes(type)
              );
              if (!isValidType) {
                throw new ValidationError(
                  `Question serial ${question.question_serial} requires supported file type(s): [${supportedTypes.join(', ')}].`
                );
              }
            }
          }
        }

        normalizedAnswers.set(serialKey, answerArray);
      }
    }

    const formResponse = await FormResponse.create({
      form_id: form._id,
      member_id: member_id || null,
      answers: normalizedAnswers,
      submitted_at: new Date(),
    });

    return {
      response_id: formResponse._id,
      form_id: form._id,
      submitted_at: formResponse.submitted_at,
    };
  }

  /**
   * Fetch all responses for a form
   */
  static async getFormResponses(form_id) {
    if (!mongoose.Types.ObjectId.isValid(form_id)) {
      throw new ValidationError('Invalid form ID format.');
    }

    const form = await Form.findById(form_id).lean();
    if (!form) {
      throw new NotFoundError('Form not found.');
    }

    const responses = await FormResponse.find({ form_id })
      .sort({ submitted_at: -1 })
      .lean();

    const formattedResponses = responses.map((r) => {
      let ansObj = {};
      if (r.answers instanceof Map) {
        ansObj = Object.fromEntries(r.answers);
      } else if (r.answers && typeof r.answers === 'object') {
        ansObj = r.answers;
      }
      return {
        response_id: r._id,
        form_id: r.form_id,
        member_id: r.member_id,
        answers: ansObj,
        submitted_at: r.submitted_at,
      };
    });

    return {
      form_id: form._id,
      title: form.title,
      total_responses: formattedResponses.length,
      responses: formattedResponses,
    };
  }

  /**
   * Fetch single response details
   */
  static async getSingleResponse(form_id, response_id) {
    if (!mongoose.Types.ObjectId.isValid(form_id) || !mongoose.Types.ObjectId.isValid(response_id)) {
      throw new ValidationError('Invalid ID format provided.');
    }

    const response = await FormResponse.findOne({ _id: response_id, form_id }).lean();
    if (!response) {
      throw new NotFoundError('Form response not found.');
    }

    let ansObj = {};
    if (response.answers instanceof Map) {
      ansObj = Object.fromEntries(response.answers);
    } else if (response.answers && typeof response.answers === 'object') {
      ansObj = response.answers;
    }

    return {
      response_id: response._id,
      form_id: response.form_id,
      member_id: response.member_id,
      answers: ansObj,
      submitted_at: response.submitted_at,
    };
  }
}
