// src/api/doctorApi.js
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

/**
 * Get doctor dashboard data including today's appointments and stats
 * @param {number} doctorId - The doctor's ID
 * @returns {Promise<Object>} Dashboard data
 */
export const getDoctorDashboard = async (doctorId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/doctors/${doctorId}/dashboard/`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Error fetching doctor dashboard:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch dashboard data'
    };
  }
};

/**
 * Get appointments for a specific date
 * @param {number} doctorId - The doctor's ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Appointments for the date
 */
export const getAppointmentsByDate = async (doctorId, date) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/doctors/${doctorId}/appointments_by_date/`, {
      params: { date }
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Error fetching appointments by date:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch appointments'
    };
  }
};

/**
 * Get all appointments with optional filters
 * @param {Object} params - Query parameters (date, status, doctor, etc.)
 * @returns {Promise<Object>} List of appointments
 */
export const getAppointments = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/appointments/`, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch appointments'
    };
  }
};

/**
 * Update appointment status
 * @param {number} appointmentId - The appointment ID
 * @param {string} status - New status (booked, checked_in, completed, cancelled)
 * @returns {Promise<Object>} Updated appointment
 */
export const updateAppointmentStatus = async (appointmentId, status) => {
  try {
    const response = await axios.patch(`${API_BASE_URL}/appointments/${appointmentId}/`, {
      status
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Error updating appointment status:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to update appointment'
    };
  }
};

/**
 * Get medical records for a patient
 * @param {number} patientId - The patient's ID
 * @returns {Promise<Object>} List of medical records
 */
export const getPatientMedicalRecords = async (patientId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/patients/${patientId}/history/`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Error fetching medical records:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch medical records'
    };
  }
};

/**
 * Get doctor details
 * @param {number} doctorId - The doctor's ID
 * @returns {Promise<Object>} Doctor details
 */
export const getDoctorDetails = async (doctorId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/doctors/${doctorId}/`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Error fetching doctor details:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch doctor details'
    };
  }
};

/**
 * Get all patients that a doctor has seen (through appointments)
 * @param {number} doctorId - The doctor's ID
 * @returns {Promise<Object>} List of patients with last service and visit info
 */
export const getDoctorPatients = async (doctorId) => {
  try {
    console.log('[DoctorAPI] Fetching patients for doctor:', doctorId);
    const response = await axios.get(`${API_BASE_URL}/doctors/${doctorId}/patients/`);
    console.log('[DoctorAPI] Patients response:', response.data);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[DoctorAPI] Error fetching doctor patients:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch patients'
    };
  }
};

/**
 * Get comprehensive patient details for diagnosis page
 * @param {number} patientId - The patient's ID
 * @returns {Promise<Object>} Patient details with allergies and last visit
 */
export const getPatientDetails = async (patientId) => {
  try {
    console.log('[DoctorAPI] Fetching patient details:', patientId);
    const response = await axios.get(`${API_BASE_URL}/patients/${patientId}/details/`);
    console.log('[DoctorAPI] Patient details response:', response.data);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[DoctorAPI] Error fetching patient details:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch patient details'
    };
  }
};

/**
 * Save a diagnosis/medical record for a patient
 * @param {number} patientId - The patient's ID
 * @param {Object} diagnosisData - The diagnosis data
 * @param {number} diagnosisData.doctor_id - The doctor's ID
 * @param {number} [diagnosisData.appointment_id] - Optional appointment ID
 * @param {string} diagnosisData.diagnosis - The diagnosis text
 * @param {string} diagnosisData.notes - General treatment notes
 * @param {Array} diagnosisData.medications - Array of medication objects
 * @returns {Promise<Object>} Result with record_id and prescription_id
 */
export const saveDiagnosis = async (patientId, diagnosisData) => {
  try {
    console.log('[DoctorAPI] Saving diagnosis for patient:', patientId, diagnosisData);
    const response = await axios.post(`${API_BASE_URL}/patients/${patientId}/save_diagnosis/`, diagnosisData);
    console.log('[DoctorAPI] Save diagnosis response:', response.data);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[DoctorAPI] Error saving diagnosis:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to save diagnosis'
    };
  }
};

/**
 * Get medications from database (supports search)
 * @param {Object} params - Query params (q, limit)
 * @returns {Promise<Object>} List of medications
 */
export const getMedications = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/medications/`, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[DoctorAPI] Error fetching medications:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch medications'
    };
  }
};

/**
 * Get patient lab results in FHIR-oriented format (DiagnosticReport bundle + ui results)
 * @param {number} patientId - The patient's ID
 * @returns {Promise<Object>} Lab results payload
 */
export const getPatientLabResults = async (patientId, params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/patients/${patientId}/lab_results/`, {
      params: {
        status: params.status || 'all',
        include_local: params.includeLocal ? 1 : 0,
      },
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[DoctorAPI] Error fetching patient lab results:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch patient lab results'
    };
  }
};

/**
 * Mark a lab result as reviewed by doctor
 * @param {number} fileId - PatientFile id
 * @param {number} doctorId - Doctor id
 * @returns {Promise<Object>}
 */
export const markLabResultReviewed = async (fileId, doctorId) => {
  try {
    const response = await axios.patch(`${API_BASE_URL}/lab-results/${fileId}/review/`, {
      doctor_id: doctorId
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[DoctorAPI] Error marking lab result reviewed:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to mark lab result reviewed'
    };
  }
};

/**
 * Dispatch prescription to pharmacy as FHIR MedicationRequest bundle
 * @param {number} prescriptionId
 * @param {string} [idempotencyKey]
 * @returns {Promise<Object>}
 */
export const dispatchPrescriptionToPharmacy = async (prescriptionId, idempotencyKey) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/integration/fhir/pharmacy/dispatch/`, {
      prescription_id: prescriptionId,
      idempotency_key: idempotencyKey
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[DoctorAPI] Error dispatching prescription to pharmacy:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to dispatch prescription'
    };
  }
};

/**
 * Get pharmacy dispatch status for a prescription
 * @param {number} prescriptionId
 * @returns {Promise<Object>}
 */
export const getPharmacyDispatchStatus = async (prescriptionId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/prescriptions/${prescriptionId}/pharmacy_dispatch_status/`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[DoctorAPI] Error fetching pharmacy dispatch status:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch pharmacy dispatch status'
    };
  }
};

export const retryPharmacyDispatch = async (prescriptionId) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/prescriptions/${prescriptionId}/retry_pharmacy_dispatch/`);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('[DoctorAPI] Error retrying pharmacy dispatch:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to retry pharmacy dispatch'
    };
  }
};

/**
 * Get medication suggestions based on disease label
 * @param {Object} params - Query params (q, limit)
 * @returns {Promise<Object>} List of medications
 */
export const getMedicationSuggestions = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/medications/suggest/`, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[DoctorAPI] Error fetching medication suggestions:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch medication suggestions'
    };
  }
};

/**
 * Search ontology concepts (cached via backend)
 * @param {Object} params - Query params (q, type, ontologies, limit)
 * @returns {Promise<Object>} List of ontology concepts
 */
export const searchOntology = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/ontology/search/`, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[DoctorAPI] Error searching ontology:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to search ontology'
    };
  }
};

/**
 * Get comprehensive patient profile including visit history and prescriptions
 * @param {number} patientId - The patient's ID
 * @returns {Promise<Object>} Full patient profile with visits
 */
export const getPatientProfile = async (patientId) => {
  try {
    console.log('[DoctorAPI] Fetching patient profile:', patientId);
    const response = await axios.get(`${API_BASE_URL}/patients/${patientId}/profile/`);
    console.log('[DoctorAPI] Patient profile response:', response.data);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[DoctorAPI] Error fetching patient profile:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch patient profile'
    };
  }
};

/**
 * Update patient additional info (email, notes, allergies, medical history, surgeries)
 * @param {number} patientId - The patient's ID
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} Updated patient info
 */
export const updatePatientInfo = async (patientId, data) => {
  try {
    console.log('[DoctorAPI] Updating patient info:', patientId, data);
    const response = await axios.post(`${API_BASE_URL}/patients/${patientId}/update_info/`, data);
    console.log('[DoctorAPI] Update patient response:', response.data);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[DoctorAPI] Error updating patient info:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to update patient info'
    };
  }
};

/**
 * Get all allergies for dropdown selection
 * @returns {Promise<Object>} List of allergies
 */
export const getAllergies = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/allergies/`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[DoctorAPI] Error fetching allergies:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch allergies'
    };
  }
};

/**
 * Add a new allergy to the system
 * @param {string} name - Allergy name
 * @returns {Promise<Object>} Created/existing allergy
 */
export const addAllergy = async (name) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/allergies/`, { name });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[DoctorAPI] Error adding allergy:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to add allergy'
    };
  }
};

/**
 * Get all medical conditions for dropdown selection
 * @returns {Promise<Object>} List of medical conditions
 */
export const getMedicalConditions = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/medical-conditions/`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[DoctorAPI] Error fetching medical conditions:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch medical conditions'
    };
  }
};

/**
 * Add a new medical condition to the system
 * @param {string} name - Condition name
 * @returns {Promise<Object>} Created/existing condition
 */
export const addMedicalCondition = async (name) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/medical-conditions/`, { name });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[DoctorAPI] Error adding medical condition:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to add medical condition'
    };
  }
};

/**
 * Get all surgery types for dropdown selection
 * @returns {Promise<Object>} List of surgery types
 */
export const getSurgeryTypes = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/surgery-types/`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[DoctorAPI] Error fetching surgery types:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch surgery types'
    };
  }
};

/**
 * Add a new surgery type to the system
 * @param {string} name - Surgery type name
 * @returns {Promise<Object>} Created/existing surgery type
 */
export const addSurgeryType = async (name) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/surgery-types/`, { name });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[DoctorAPI] Error adding surgery type:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to add surgery type'
    };
  }
};

/**
 * Dispatch doctor-ordered lab/scan requests to lab system
 * @param {number} patientId
 * @param {number} doctorId
 * @param {Array<{name:string, category:string, code?:string, notes?:string}>} orders
 * @returns {Promise<Object>}
 */
export const dispatchLabOrders = async (patientId, doctorId, orders = []) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/integration/fhir/lab-orders/dispatch/`, {
      patient_id: patientId,
      doctor_id: doctorId,
      orders,
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[DoctorAPI] Error dispatching lab orders:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to dispatch lab orders'
    };
  }
};

/**
 * Get live lab catalog (lab tests + scans) from integrated lab system
 */
export const getLabCatalog = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/integration/fhir/lab-catalog/`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('[DoctorAPI] Error fetching lab catalog:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch lab catalog',
    };
  }
};

export default {
  getDoctorDashboard,
  getAppointmentsByDate,
  getAppointments,
  updateAppointmentStatus,
  getPatientMedicalRecords,
  getDoctorDetails,
  getDoctorPatients,
  getPatientDetails,
  getPatientLabResults,
  markLabResultReviewed,
  dispatchPrescriptionToPharmacy,
  getPharmacyDispatchStatus,
  retryPharmacyDispatch,
  saveDiagnosis,
  getMedications,
  getPatientProfile,
  updatePatientInfo,
  getAllergies,
  addAllergy,
  getMedicalConditions,
  addMedicalCondition,
  getSurgeryTypes,
  addSurgeryType,
  dispatchLabOrders,
  getLabCatalog,
};
