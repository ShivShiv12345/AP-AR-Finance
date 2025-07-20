// **AIRTABLE CONFIGURATION - EDIT THESE VALUES**
const AIRTABLE_CONFIG = {
    // 🔴 EDIT LINE 3: Add your Airtable Personal Access Token here
    PAT: 'patcpUIfwD7dO31yP.d4f977687c0a13f9ababa4f5c96954c68bd07d09a9e3eb6a1391acb7f2f2375b',
    
    // 🔴 EDIT LINE 6: Add your Airtable Base ID here
    BASE_ID: 'appkUal6c4oanOR4X',
    
    // 🔴 EDIT LINES 9-10: Add your table names/IDs here
    AR_TABLE_NAME: 'AR Import', // Customer Invoice table
    AP_TABLE_NAME: 'AP Import', // Vendor Bill table
};

// Field definitions
const arFields = [
    'Batch ID', 'Customer Name', 'Customer Email', 'Invoice Number ', 
    'Invoice Date', 'Invoice Amount', 'Due Date'
];

const apFields = [
    'Batch ID','Vendor ID', 'Vendor Name', 'Vendor Email', 'Invoice Number', 
    'Invoice Date', 'Invoice Amount', 'Due Date'
];

// Global variables
let uploadedFile = null;
let isProcessing = false;

// DOM elements
const invoiceTypeSelect = document.getElementById('invoiceType');
const fileUploadInput = document.getElementById('fileUpload');
const uploadArea = document.getElementById('uploadArea');
const fileName = document.getElementById('fileName');
const submitBtn = document.getElementById('submitBtn');
const submitText = document.getElementById('submitText');

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
});

function setupEventListeners() {
    // Invoice type selection
    invoiceTypeSelect.addEventListener('change', validateForm);
    
    // File upload
    fileUploadInput.addEventListener('change', handleFileUpload);
    uploadArea.addEventListener('click', () => fileUploadInput.click());
    
    // Drag and drop
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('drop', handleFileDrop);
    
    // Submit button
    submitBtn.addEventListener('click', handleSubmit);
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    processFile(file);
}

function handleDragOver(event) {
    event.preventDefault();
    uploadArea.style.borderColor = 'var(--primary)';
    uploadArea.style.backgroundColor = 'var(--muted)';
}

function handleFileDrop(event) {
    event.preventDefault();
    uploadArea.style.borderColor = 'var(--border)';
    uploadArea.style.backgroundColor = 'transparent';
    
    const file = event.dataTransfer.files[0];
    if (file) {
        processFile(file);
    }
}

// function processFile(file) {
//     const allowedTypes = [
//         'application/vnd.ms-excel',
//         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
//         'text/csv'
//     ];
    
//     if (!allowedTypes.includes(file.type)) {
//         showToast('Invalid file type', 'Please upload only Excel (.xlsx, .xls) or CSV files.', 'error');
//         return;
//     }
    
//     uploadedFile = file;
//     fileName.textContent = file.name;
//     fileName.style.display = 'block';
//     uploadArea.classList.add('file-uploaded');
    
//     showToast('File uploaded successfully', `${file.name} is ready for processing.`, 'success');
//     validateForm();
// }
function processFile(file) {
    const allowedTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv'
    ];

    if (!file || !file.type || !file.size) {
        showToast('Configuration Error', 'Invalid or unreadable file. Please re-upload the file.', 'error');
        return;
    }

    if (!allowedTypes.includes(file.type)) {
        showToast('Invalid file type', 'Please upload only Excel (.xlsx, .xls) or CSV files.', 'error');
        return;
    }

    uploadedFile = file;
    fileName.textContent = file.name;
    fileName.style.display = 'block';
    uploadArea.classList.add('file-uploaded');

    showToast('File uploaded successfully', `${file.name} is ready for processing.`, 'success');
    validateForm();
}


function validateForm() {
    const hasInvoiceType = invoiceTypeSelect.value !== '';
    const hasFile = uploadedFile !== null;
    
    submitBtn.disabled = !(hasInvoiceType && hasFile) || isProcessing;
}

// **AIRTABLE CONNECTION TEST FUNCTION**
async function testAirtableConnection() {
    try {
        // Check if configuration is complete
        if (AIRTABLE_CONFIG.PAT === 'YOUR_PERSONAL_ACCESS_TOKEN_HERE' ||
            AIRTABLE_CONFIG.BASE_ID === 'YOUR_BASE_ID_HERE' ||
            AIRTABLE_CONFIG.AR_TABLE_NAME === 'YOUR_AR_TABLE_NAME_HERE' ||
            AIRTABLE_CONFIG.AP_TABLE_NAME === 'YOUR_AP_TABLE_NAME_HERE') {
            throw new Error('Airtable configuration incomplete. Please update PAT, Base ID, and table names in script.js');
        }

        // Test connection with a simple metadata request
        const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_CONFIG.BASE_ID}/tables`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_CONFIG.PAT}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Invalid Airtable Personal Access Token (PAT). Please check your PAT in script.js');
            } else if (response.status === 404) {
                throw new Error('Invalid Airtable Base ID. Please check your Base ID in script.js');
            } else {
                const errorText = await response.text();
                throw new Error(`Airtable connection failed: ${response.status} - ${errorText}`);
            }
        }

        const result = await response.json();
        const tableNames = result.tables.map(table => table.name);
        
        // Check if specified tables exist
        if (!tableNames.includes(AIRTABLE_CONFIG.AR_TABLE_NAME)) {
            throw new Error(`AR table "${AIRTABLE_CONFIG.AR_TABLE_NAME}" not found in base. Available tables: ${tableNames.join(', ')}`);
        }
        if (!tableNames.includes(AIRTABLE_CONFIG.AP_TABLE_NAME)) {
            throw new Error(`AP table "${AIRTABLE_CONFIG.AP_TABLE_NAME}" not found in base. Available tables: ${tableNames.join(', ')}`);
        }

        return { success: true, message: 'Airtable connected successfully!' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// **AIRTABLE INTEGRATION FUNCTION - MAIN LOGIC HERE**
async function uploadToAirtable(data, tableName) {
    try {
        const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.BASE_ID}/${tableName}`;
        
        // Prepare records for Airtable format
        const records = data.map(record => ({
            fields: record
        }));

        // Batch upload (Airtable allows max 10 records per request)
        const batchSize = 10;
        const batches = [];
        
        for (let i = 0; i < records.length; i += batchSize) {
            batches.push(records.slice(i, i + batchSize));
        }

        let successCount = 0;
        
        for (const batch of batches) {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_CONFIG.PAT}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    records: batch
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                let errorMessage = `HTTP ${response.status}`;
                
                if (response.status === 401) {
                    errorMessage = 'Invalid Airtable Personal Access Token (PAT)';
                } else if (response.status === 404) {
                    errorMessage = `Table "${tableName}" not found in Airtable base`;
                } else if (response.status === 422 && errorData.error) {
                    errorMessage = `Airtable field error: ${errorData.error.message || 'Invalid field data'}`;
                } else if (errorData.error) {
                    errorMessage = errorData.error.message || errorMessage;
                }
                
                throw new Error(errorMessage);
            }

            const result = await response.json();
            successCount += result.records.length;
        }

        return successCount;
    } catch (error) {
        console.error('Airtable upload error:', error);
        throw error;
    }
}

function parseCSVData(text) {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    const data = lines.slice(1)
        .filter(line => line.trim())
        .map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const record = {};
            headers.forEach((header, index) => {
                record[header] = values[index] || '';
            });
            return record;
        });
    
    return data;
}

async function processFileData(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const data = parseCSVData(text);
                resolve(data);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

async function handleSubmit() {
    if (!invoiceTypeSelect.value || !uploadedFile) {
        showToast('Missing information', 'Please select invoice type and upload a file.', 'error');
        return;
    }

    setProcessingState(true);
    
    try {
        // First test Airtable connection
        const connectionTest = await testAirtableConnection();
        if (!connectionTest.success) {
            throw new Error(connectionTest.message);
        }

        // Show connection success message
        showToast('Airtable Connected', connectionTest.message, 'success');
        
        // Wait a moment for user to see the success message
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Process file data
        const fileData = await processFileData(uploadedFile);
        
        if (fileData.length === 0) {
            throw new Error('No data found in file');
        }

        // Determine table name based on invoice type
        const tableName = invoiceTypeSelect.value === 'ar' 
            ? AIRTABLE_CONFIG.AR_TABLE_NAME 
            : AIRTABLE_CONFIG.AP_TABLE_NAME;

        // Upload to Airtable
        const uploadedCount = await uploadToAirtable(fileData, tableName);

        showToast(
            'Upload successful!', 
            `Successfully uploaded ${uploadedCount} records to Airtable.`, 
            'success'
        );

        // Reset form
        resetForm();
        
    } catch (error) {
        console.error('Upload error:', error);
        showToast(
            'Configuration Error', 
            error.message, 
            'error'
        );
    } finally {
        setProcessingState(false);
    }
}

function setProcessingState(processing) {
    isProcessing = processing;
    submitBtn.disabled = processing;
    
    if (processing) {
        submitBtn.classList.add('processing');
        submitText.textContent = 'Processing...';
    } else {
        submitBtn.classList.remove('processing');
        submitText.textContent = 'Upload to System';
    }
    
    validateForm();
}

function resetForm() {
    uploadedFile = null;
    invoiceTypeSelect.value = '';
    fileUploadInput.value = '';
    fileName.style.display = 'none';
    fileName.textContent = '';
    uploadArea.classList.remove('file-uploaded');
    validateForm();
}

function downloadTemplate(type) {
    const fields = type === 'ar' ? arFields : apFields;
    const csvContent = fields.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type.toUpperCase()}_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

function showToast(title, description, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        <div class="toast-title">${title}</div>
        <div class="toast-description">${description}</div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // Remove toast after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toastContainer.removeChild(toast);
        }, 300);
    }, 5000);
}

// Export functions for global access
window.downloadTemplate = downloadTemplate;
