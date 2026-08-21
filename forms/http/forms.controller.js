import { FormsInternalService } from '../internal/forms.service.internal.js';
import { sendSuccess } from '../../shared/utils/responseFormatter.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { ValidationError } from '../../shared/errors/index.js';

/**
 * Controller to create a new form with structured questions
 */
export const createForm = asyncHandler(async (req, res) => {
  const { title, description, questions } = req.body;
  const created_by = req.user ? req.user.id : null;
  const result = await FormsInternalService.createForm({
    title,
    description,
    questions,
    created_by,
  });
  return sendSuccess(res, result, 201);
});

/**
 * Controller to list forms with pagination
 */
export const getForms = asyncHandler(async (req, res) => {
  const { page, limit, is_active } = req.query;
  const result = await FormsInternalService.getForms({ page, limit, is_active });
  return sendSuccess(res, result, 200);
});

/**
 * Controller to get full form details & ordered questions
 */
export const getFormById = asyncHandler(async (req, res) => {
  const { form_id } = req.params;
  const result = await FormsInternalService.getFormById(form_id);
  return sendSuccess(res, result, 200);
});

/**
 * Controller to update an existing form
 */
export const updateForm = asyncHandler(async (req, res) => {
  const { form_id } = req.params;
  const updated_by = req.user ? req.user.id : null;
  const result = await FormsInternalService.updateForm(form_id, req.body, updated_by);
  return sendSuccess(res, result, 200);
});

/**
 * Controller to delete a form and its questions & responses
 */
export const deleteForm = asyncHandler(async (req, res) => {
  const { form_id } = req.params;
  const result = await FormsInternalService.deleteForm(form_id);
  return sendSuccess(res, result, 200);
});

/**
 * Controller to submit a response to a form
 */
export const submitResponse = asyncHandler(async (req, res) => {
  const { form_id } = req.params;
  const { answers, email } = req.body;
  const member_id = req.user ? req.user.id : null;
  const result = await FormsInternalService.submitResponse(form_id, member_id, answers, email);
  return sendSuccess(res, result, 201);
});

/**
 * Controller to check whether a response exists for a specific email
 */
export const checkResponseExists = asyncHandler(async (req, res) => {
  const { form_id } = req.params;
  const { email } = req.query;
  const result = await FormsInternalService.checkResponseExists(form_id, email);
  return sendSuccess(res, result, 200);
});

/**
 * Controller to get all responses for a form
 */
export const getFormResponses = asyncHandler(async (req, res) => {
  const { form_id } = req.params;
  const result = await FormsInternalService.getFormResponses(form_id);
  return sendSuccess(res, result, 200);
});

/**
 * Controller to get a single response details
 */
export const getSingleResponse = asyncHandler(async (req, res) => {
  const { form_id, response_id } = req.params;
  const result = await FormsInternalService.getSingleResponse(form_id, response_id);
  return sendSuccess(res, result, 200);
});

/**
 * Controller to process single file upload for form responses and return Cloudinary URL
 */
export const uploadFormFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ValidationError('No file provided for upload.');
  }

  const { processUploadedFile } = await import('../../shared/utils/fileUpload.js');
  const uploadResult = await processUploadedFile(req.file, {
    folder: 'aces/form_responses',
    resource_type: 'auto',
  });

  return sendSuccess(
    res,
    {
      url: uploadResult.secureUrl,
      public_id: uploadResult.publicId,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
    },
    201
  );
});
