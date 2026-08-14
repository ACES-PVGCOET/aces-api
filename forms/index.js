import { FormsInternalService } from './internal/forms.service.internal.js';

/**
 * PUBLIC INTERFACE FOR FORMS DOMAIN MODULE
 * Exposed to other domain modules (e.g. Events module) and orchestration layer.
 * DO NOT import directly from forms/internal/* in other modules.
 */
export const FormsService = {
  /**
   * Create a new form programmatically
   */
  createForm: (data) => FormsInternalService.createForm(data),

  /**
   * Retrieves form details and questions by ID
   */
  getFormById: (formId) => FormsInternalService.getFormById(formId),

  /**
   * Retrieves paginated list of forms
   */
  getForms: (params) => FormsInternalService.getForms(params),

  /**
   * Updates form details and questions
   */
  updateForm: (formId, updateData, userId) => FormsInternalService.updateForm(formId, updateData, userId),

  /**
   * Deletes form and associated questions & responses
   */
  deleteForm: (formId) => FormsInternalService.deleteForm(formId),

  /**
   * Submits a form response with validation
   */
  submitResponse: (formId, memberId, answers) => FormsInternalService.submitResponse(formId, memberId, answers),

  /**
   * Gets all responses for a form
   */
  getFormResponses: (formId) => FormsInternalService.getFormResponses(formId),

  /**
   * Gets single response by ID
   */
  getSingleResponse: (formId, responseId) => FormsInternalService.getSingleResponse(formId, responseId),
};

export default FormsService;
