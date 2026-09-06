import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs';
import mongoose from 'mongoose';
import { MembershipModel, MEMBERSHIP_STATUS, RECEIPT_STATUS } from './membership.model.js';
import { NotFoundError, ValidationError, ConflictError, ForbiddenError } from '../../shared/errors/index.js';
import { processUploadedFile } from '../../shared/utils/fileUpload.js';
import { generateIdCardPng, calculateValidUpto } from '../../shared/utils/idCardGenerator.js';
import { sendMembershipVerificationEmail } from '../../shared/utils/mailer.js';

const execFileAsync = util.promisify(execFile);

/**
 * Clean and format contact phone number to 10 digits
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) return '';
  const str = String(rawPhone).trim();
  // Handle Excel float / scientific strings like 7.219366476E9
  if (str.includes('E') || str.includes('e')) {
    try {
      return String(Math.floor(Number(str)));
    } catch (_e) {
      // Fallback
    }
  }
  // Strip non-digits
  const digits = str.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  return digits || str;
}

/**
 * Standardize Class names: SE/SY -> SE, TE -> TE, BE -> BE
 */
function normalizeClassName(rawClass) {
  if (!rawClass) return 'SE';
  const c = String(rawClass).trim().toUpperCase();
  if (c === 'SY' || c === 'SE' || c.includes('SECOND')) return 'SE';
  if (c === 'TY' || c === 'TE' || c.includes('THIRD')) return 'TE';
  if (c === 'FINAL' || c === 'BE' || c === 'BTECH' || c.includes('FOURTH')) return 'BE';
  return c;
}

/**
 * Generate unique receipt number
 */
function generateReceiptNumber() {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `ACES-${year}-${randomSuffix}`;
}

export class MembershipInternalService {
  /**
   * List and filter student membership registrations with pagination and statistics
   */
  static async listMemberships({
    status = 'ALL',
    className = 'ALL',
    paymentMode = 'ALL',
    search = '',
    page = 1,
    limit = 100,
    sortBy = 'newest',
  } = {}) {
    const query = {};

    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }

    if (className && className !== 'ALL') {
      if (className.toUpperCase() === 'SE') {
        query.class_name = { $in: ['SE', 'SY'] };
      } else {
        query.class_name = new RegExp(`^${className}$`, 'i');
      }
    }

    if (paymentMode && paymentMode !== 'ALL') {
      query.payment_mode = new RegExp(`^${paymentMode}$`, 'i');
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { full_name: new RegExp(term, 'i') },
        { contact_number: new RegExp(term, 'i') },
        { email: new RegExp(term, 'i') },
        { receipt_number: new RegExp(term, 'i') },
      ];
    }

    // Sort order
    let sortOptions = { createdAt: -1 };
    if (sortBy === 'oldest') {
      sortOptions = { createdAt: 1 };
    } else if (sortBy === 'name-asc') {
      sortOptions = { full_name: 1 };
    } else if (sortBy === 'name-desc') {
      sortOptions = { full_name: -1 };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(500, parseInt(limit, 10) || 100));
    const skip = (pageNum - 1) * limitNum;

    const [items, total, stats] = await Promise.all([
      MembershipModel.find(query).sort(sortOptions).skip(skip).limit(limitNum),
      MembershipModel.countDocuments(query),
      this.getStatistics(),
    ]);

    return {
      items: items.map((item) => item.toJSON()),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      stats,
    };
  }

  /**
   * Get single membership record by ID
   */
  static async getMembershipById(id) {
    const record = await MembershipModel.findById(id);
    if (!record) {
      throw new NotFoundError(`Membership registration with ID '${id}' not found.`);
    }
    return record.toJSON();
  }

  /**
   * Retrieve and render digital ID card in PNG format by membership number
   */
  static async getIdCardByMembershipNumber(membershipNo) {
    if (!membershipNo || !membershipNo.trim()) {
      throw new ValidationError('Membership number is required.');
    }

    const cleanNo = membershipNo.trim();
    let record = await MembershipModel.findOne({
      receipt_number: new RegExp(`^${cleanNo}$`, 'i'),
    });

    if (!record && mongoose.Types.ObjectId.isValid(cleanNo)) {
      record = await MembershipModel.findById(cleanNo);
    }

    if (!record) {
      throw new NotFoundError(`Membership registration with number '${cleanNo}' not found.`);
    }

    if (record.status !== MEMBERSHIP_STATUS.VERIFIED) {
      throw new ForbiddenError(
        `Membership registration is not verified (current status: ${record.status}). ID card is only available for verified members.`
      );
    }

    const validUpto = calculateValidUpto(record.verified_at || record.createdAt);
    const pngBuffer = await generateIdCardPng({
      fullName: record.full_name,
      membershipNo: record.receipt_number || cleanNo,
      validUpto,
    });

    return {
      pngBuffer,
      receiptNumber: record.receipt_number || cleanNo,
      record: record.toJSON(),
    };
  }

  /**
   * Create a single membership registration
   */
  static async createMembership(data, file = null) {
    if (!data.full_name || !data.full_name.trim()) {
      throw new ValidationError('Student full name is required.');
    }
    if (!data.class_name || !data.class_name.trim()) {
      throw new ValidationError('Class name is required (e.g. SE, TE, BE).');
    }
    if (!data.contact_number || !data.contact_number.trim()) {
      throw new ValidationError('Contact / WhatsApp number is required.');
    }

    const cleanContact = normalizePhoneNumber(data.contact_number);
    const cleanClass = normalizeClassName(data.class_name);

    // Optional duplicate check
    const existing = await MembershipModel.findOne({
      contact_number: cleanContact,
      full_name: new RegExp(`^${data.full_name.trim()}$`, 'i'),
    });
    if (existing) {
      throw new ConflictError('A membership registration with this name and contact number already exists.');
    }

    let ssUrl = data.transaction_ss_url || '';
    if (file) {
      const uploadResult = await processUploadedFile(file, { folder: 'aces/membership_receipts' });
      ssUrl = uploadResult.secureUrl;
    }

    const newRecord = await MembershipModel.create({
      full_name: data.full_name.trim(),
      email: (data.email || '').trim().toLowerCase(),
      class_name: cleanClass,
      contact_number: cleanContact,
      payment_mode: (data.payment_mode || 'UPI').trim().toUpperCase(),
      payment_date: (data.payment_date || '').trim(),
      amount: Number(data.amount) || 450,
      transaction_ss_url: ssUrl,
      status: MEMBERSHIP_STATUS.PENDING,
      remarks: (data.remarks || '').trim(),
      source: data.source || 'manual_cms',
    });

    return newRecord.toJSON();
  }

  /**
   * Verify, reject, or reset a membership fee
   */
  static async verifyMembership(id, { status, remarks, amount, receipt_number }, currentUser = null) {
    if (!status || !Object.values(MEMBERSHIP_STATUS).includes(status.toUpperCase())) {
      throw new ValidationError(`Status must be one of: ${Object.values(MEMBERSHIP_STATUS).join(', ')}.`);
    }

    const record = await MembershipModel.findById(id);
    if (!record) {
      throw new NotFoundError(`Membership registration with ID '${id}' not found.`);
    }

    const targetStatus = status.toUpperCase();
    record.status = targetStatus;

    if (remarks !== undefined) {
      record.remarks = remarks.trim();
    }

    if (amount !== undefined && !isNaN(Number(amount))) {
      record.amount = Number(amount);
    }

    if (targetStatus === MEMBERSHIP_STATUS.VERIFIED) {
      record.verified_at = new Date();
      record.verified_by = currentUser?.name || currentUser?.email || 'Admin';
      record.verified_by_id = currentUser?.id || null;
      if (!record.receipt_number) {
        record.receipt_number = (receipt_number && receipt_number.trim()) || generateReceiptNumber();
      }
      record.receipt_status = RECEIPT_STATUS.NOT_SENT;

      if (record.email && record.email.trim()) {
        try {
          const validUpto = calculateValidUpto(record.verified_at);
          const idCardBuffer = await generateIdCardPng({
            fullName: record.full_name,
            membershipNo: record.receipt_number,
            validUpto,
          });

          const mailResult = await sendMembershipVerificationEmail({
            email: record.email.trim(),
            name: record.full_name,
            membershipNo: record.receipt_number,
            validUpto,
            idCardBuffer,
          });

          if (mailResult && mailResult.success) {
            record.receipt_status = RECEIPT_STATUS.SENT;
          }
        } catch (mailError) {
          console.error(
            `[Membership] Failed to generate/send ID card email to ${record.email}:`,
            mailError.message
          );
        }
      }
    } else if (targetStatus === MEMBERSHIP_STATUS.REJECTED) {
      record.verified_at = new Date();
      record.verified_by = currentUser?.name || currentUser?.email || 'Admin';
      record.verified_by_id = currentUser?.id || null;
    } else {
      // PENDING
      record.verified_at = null;
      record.verified_by = '';
      record.verified_by_id = null;
    }

    await record.save();
    return record.toJSON();
  }

  /**
   * Update details of an existing registration
   */
  static async updateMembership(id, updates) {
    const record = await MembershipModel.findById(id);
    if (!record) {
      throw new NotFoundError(`Membership registration with ID '${id}' not found.`);
    }

    const allowedFields = [
      'full_name',
      'email',
      'class_name',
      'contact_number',
      'payment_mode',
      'payment_date',
      'amount',
      'transaction_ss_url',
      'remarks',
      'receipt_number',
      'receipt_status',
    ];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        if (field === 'class_name') {
          record.class_name = normalizeClassName(updates[field]);
        } else if (field === 'contact_number') {
          record.contact_number = normalizePhoneNumber(updates[field]);
        } else if (field === 'amount') {
          record.amount = Number(updates[field]) || record.amount;
        } else {
          record[field] = updates[field];
        }
      }
    });

    await record.save();
    return record.toJSON();
  }

  /**
   * Delete a membership record
   */
  static async deleteMembership(id) {
    const record = await MembershipModel.findByIdAndDelete(id);
    if (!record) {
      throw new NotFoundError(`Membership registration with ID '${id}' not found.`);
    }
    return { message: 'Membership record deleted successfully.' };
  }

  /**
   * Bulk import array of registrations
   */
  static async bulkImport(records, source = 'bulk_import') {
    if (!Array.isArray(records) || records.length === 0) {
      throw new ValidationError('An array of registration records is required for bulk import.');
    }

    let importedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const name = (row.full_name || row.name || '').trim();
      const rawContact = row.contact_number || row.phone || row.contact || '';
      const cleanContact = normalizePhoneNumber(rawContact);
      const cleanClass = normalizeClassName(row.class_name || row.class || 'SE');

      if (!name) {
        skippedCount++;
        errors.push({ index: i, error: 'Student full name is missing.' });
        continue;
      }

      // Check duplicate
      const existing = await MembershipModel.findOne({
        contact_number: cleanContact,
        full_name: new RegExp(`^${name}$`, 'i'),
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      await MembershipModel.create({
        full_name: name,
        email: (row.email || '').trim().toLowerCase(),
        class_name: cleanClass,
        contact_number: cleanContact,
        payment_mode: (row.payment_mode || 'UPI').trim().toUpperCase(),
        payment_date: (row.payment_date || '').trim(),
        amount: Number(row.amount) || 450,
        transaction_ss_url: (row.transaction_ss_url || row.screenshot_url || '').trim(),
        status: MEMBERSHIP_STATUS.PENDING,
        registration_timestamp: (row.registration_timestamp || row.timestamp || '').trim(),
        remarks: (row.remarks || '').trim(),
        source,
      });

      importedCount++;
    }

    return {
      importedCount,
      skippedCount,
      totalSubmitted: records.length,
      errors,
    };
  }

  /**
   * Import directly from Excel file located at filePath
   */
  static async importFromLocalExcel(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      throw new NotFoundError(`Spreadsheet file not found at path: ${filePath || 'none provided'}`);
    }
    const pythonScript = `
import sys, json, zipfile, xml.etree.ElementTree as ET

file_path = sys.argv[1]
with zipfile.ZipFile(file_path) as z:
    shared_strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
            text = ''.join(t.text for t in si.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t') if t.text)
            shared_strings.append(text)

    tree = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    rows = tree.findall('.//ns:row', ns)
    
    results = []
    for r in rows[1:]:
        cells = {}
        for c in r.findall('ns:c', ns):
            coord = c.attrib.get('r', '')
            col = ''.join([ch for ch in coord if ch.isalpha()])
            t = c.attrib.get('t')
            v = c.find('ns:v', ns)
            val = v.text if v is not None else ''
            if t == 's' and val:
                val = shared_strings[int(val)]
            cells[col] = val
        
        name = (cells.get('B') or '').strip()
        if not name:
            continue

        raw_phone = cells.get('D') or ''
        try:
            phone = str(int(float(raw_phone)))
        except:
            phone = raw_phone.strip()

        results.append({
            'full_name': name,
            'class_name': (cells.get('C') or 'SE').strip(),
            'contact_number': phone,
            'payment_mode': (cells.get('E') or 'UPI').strip(),
            'payment_date': (cells.get('F') or '').strip(),
            'transaction_ss_url': (cells.get('G') or '').strip(),
            'registration_timestamp': (cells.get('A') or '').strip(),
        })

    print(json.dumps(results))
`;

    const { stdout } = await execFileAsync('python3', ['-c', pythonScript, filePath]);
    const parsedRecords = JSON.parse(stdout);

    return await this.bulkImport(parsedRecords, 'excel_file_import');
  }

  /**
   * Get high-level summary statistics
   */
  static async getStatistics() {
    const [total, pending, verified, rejected, classesAgg, modesAgg, totalAmountAgg] = await Promise.all([
      MembershipModel.countDocuments(),
      MembershipModel.countDocuments({ status: MEMBERSHIP_STATUS.PENDING }),
      MembershipModel.countDocuments({ status: MEMBERSHIP_STATUS.VERIFIED }),
      MembershipModel.countDocuments({ status: MEMBERSHIP_STATUS.REJECTED }),
      MembershipModel.aggregate([
        { $group: { _id: '$class_name', count: { $sum: 1 } } },
      ]),
      MembershipModel.aggregate([
        { $group: { _id: '$payment_mode', count: { $sum: 1 } } },
      ]),
      MembershipModel.aggregate([
        { $match: { status: MEMBERSHIP_STATUS.VERIFIED } },
        { $group: { _id: null, totalCollected: { $sum: '$amount' } } },
      ]),
    ]);

    const byClass = {};
    classesAgg.forEach((item) => {
      if (item._id) byClass[item._id] = item.count;
    });

    const byMode = {};
    modesAgg.forEach((item) => {
      if (item._id) byMode[item._id] = item.count;
    });

    const totalCollected = totalAmountAgg[0]?.totalCollected || 0;

    return {
      total,
      pending,
      verified,
      rejected,
      byClass,
      byMode,
      totalCollected,
    };
  }
}
