// Import functions (this is ignored in Google Apps Script)
let extractNettoReceiptData;
if (typeof require !== 'undefined') {
  const { extractNettoReceiptData } = require("./src/extractNettoReceiptData");
}

// Constants
const purchaseIdColumnIndex = 0;
const dateColumnIndex = 2;
const totalPriceColumnIndex = 3;
const storeIdColumnIndex = 4;

/**
 * Process unread emails from Netto Marken-Discount or the Netto app
 * with the label 'kassenbons', extract receipt data, and add it to the Google Sheet.
 */
function processEmailsAndAddToSheet() {
  var searchQuery = '{from:nicht.antworten@reply.netto-online.de from:noreply@netto-app.de} label:kassenbons is:unread';
  var threads = GmailApp.search(searchQuery);

  try {
    Logger.log(`Found ${threads.length} threads to process`);
    processThreads(threads);
    Logger.log('Email processing completed');
  } catch (error) {
    Logger.log('Critical error in main function: ' + error.toString());
  }

}

/**
 * Process a collection of email threads
 */
function processThreads(threads){
    for (thread of threads) {
      processThread(thread);
  }
}

/**
 * Process a singl email thread
 */
function processThread(thread){
  try {
    var messages = thread.getMessages();
    for (message of messages) {
      processMessage(message);
    }
  } catch (error) {
    Logger.log(`Error processing thread ${error.toString()}`);
    // mark problematic emails
    thread.addLabel(GmailApp.getUserLabelByName('processing-error'));
  }
}

/**
 * Process a single email message
 */
function processMessage(message){
  try {
      var date = message.getDate();
      var subject = message.getSubject();
      Logger.log(`Processing email: ${subject} from ${date}`);

      var body = message.getBody();
      var data = extractReceiptData(body);
      
      if (data) {
        loadReceiptDataToSheet(data, 'Netto Marken-Discount', date)
        message.markRead();
        Logger.log(`Sucessfully processed email ${subject}`);
      }
  } catch (error) {
    Logger.log(`Error processing message ${error.toString()}`);
  }
}

/**
 * Extract receipt data from email body with error handling
 */
function extractReceiptData(body) {
  try {
    var data = extractNettoReceiptData(body);
    if (!data || Object.keys(data).length === 0) {
      Logger.log('Warning: No receipt data extracted from email');
      return null;
    }
    return data;
  } catch (error) {
    Logger.log(`Error extracting receipt data: ${error.toString()}`);
    return null;
  }
}

/**
 * Orchestrate the loading of receipt data into the Google Sheet.
 * Retrieve or creates the store and purchase IDs, then loads the line items.
 *
 * @param {object} data - An object containing the extracted receipt data.
 * @param {string} data.storeAddress - The address of the store.
 * @param {Array<object>} data.lineItems - An array of line item objects.
 * @param {string} storeName - The name of the store.
 * @param {string|Date} date - The date of the purchase (can be a string that `new Date()` can parse or a Date object).
 * @param {number} totalPrice - The total price of the purchase.
 */
function loadReceiptDataToSheet(data, storeName, date, totalPrice) {
  const storeId = getStoreId(storeName, data);
  const purchaseId = getPurchaseId(storeId, date, totalPrice)
  loadLineItems(purchaseId, data);
}

/**
 * Retrieve the ID of an existing store or creates a new one in the 'stores' sheet.
 * Check for duplicates based on store name and address.
 *
 * @param {string} storeName - The name of the store.
 * @param {object} data - An object containing the extracted receipt data.
 * @param {string} data.storeAddress - The address of the store.
 * @returns {string|number|null|undefined} The ID of the existing or newly created store,
 * or null/undefined if an issue occurs.
 */
function getStoreId(storeName, data){
  // check if store exists in db
  // if store does not exits, create one
  // else retrieve store id

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const storesSheet = ss.getSheetByName("stores");
  const storesData = storesSheet.getDataRange().getValues(); // Assuming headers in first row
  const storeAddresses = storesData.map(row => row[2]).slice(1); // Extract addresses, skip header

  let storeId;
  Logger.log(storesData)
  const existingStoreIndex = storeAddresses.indexOf(data.storeAddress);

  if (existingStoreIndex === -1) {
    // Store doesn't exist, create a new one
    // const nextStoreId = // Logic to determine the next unique store ID (e.g., incrementing the last ID)
    storesSheet.appendRow([null, storeName, data.storeAddress /*, other store details if you have them */]);
    storeId = getLastRowData(storesData)[0];
  } else {
    // Store exists, retrieve its ID
    storeId = storesData[existingStoreIndex + 1][0]; // Assuming storeId is in the first column
  }
  Logger.log({ storeId: storeId });

  return storeId
}

/**
 * Retrieve the ID of an existing purchase or creates a new one in the 'purchases' sheet.
 * Check for duplicates based on store ID, date, and total price.
 *
 * @param {string} storeId - The ID of the store where the purchase was made.
 * @param {string|Date} date - The date of the purchase (can be a string that `new Date()` can parse or a Date object).
 * @param {number} totalPrice - The total price of the purchase.
 * @returns {string} The ID of the existing or newly created purchase.
 */
function getPurchaseId(storeId, date, totalPrice) {
  const purchaseDate = new Date(date); // Convert the date string to a Date object
  var purchaseId = findMatchingPurchaseId(getPurchaseData(), storeId, purchaseDate, 0)

  if (purchaseId){
    return purchaseId;
  }

  // Purchase not found, create a new one
  purchasesSheet.appendRow([null, null, purchaseDate, totalPrice, storeId]);
  purchasesData = purchasesSheet.getDataRange().getValues(); // Assuming headers
  purchaseId = getLastRowData(getPurchaseData())[purchaseIdColumnIndex];
  return purchaseId;
}

function getPurchaseData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const purchasesSheet = ss.getSheetByName("purchases");
  const purchasesData = purchasesSheet.getDataRange().getValues(); // Assuming headers
  return purchasesData
}

function findMatchingPurchaseId(purchasesData, storeId, purchaseDate, totalPrice) {
  // Skip header row (index 0)
  for (let i = 1; i < purchasesData.length; i++) {
    const row = purchasesData[i];
    const existingDate = new Date(row[dateColumnIndex]);
    
    const isMatchingStore = row[storeIdColumnIndex] === storeId;
    const isMatchingDate = existingDate.toString() === purchaseDate.toString();
    // const isMatchingPrice = Math.abs(parseFloat(row[totalPriceColumnIndex]) - totalPrice) < 0.001;
    const isMatchingPrice = true
    
    if (isMatchingStore && isMatchingDate && isMatchingPrice) {
      return row[purchaseIdColumnIndex];
    }
  }
  
  return null; // No matching purchase found
}

/**
 * Load line item data into the 'priceLog' sheet.
 *
 * @param {string} purchaseId - The ID of the purchase to associate with these line items.
 * @param {object} data - An object containing the extracted receipt data.
 * @param {Array<object>} data.lineItems - An array of line item objects.
 * @param {string} data.lineItems[].itemDescription - The description of the item.
 * @param {number} data.lineItems[].quantity - The quantity of the item.
 * @param {string|null} data.lineItems[].unit - The unit of the item (e.g., 'kg', 'pcs').
 * @param {number|null} data.lineItems[].unitPrice - The price per unit of the item.
 * @param {string} data.lineItems[].currency - The currency of the price (e.g., 'EUR').
 * @param {number} data.lineItems[].totalPrice - The total price of the line item.
 */
function loadLineItems(purchaseId, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const priceLogSheet = ss.getSheetByName("priceLog");
  const lineItems = data.lineItems;

  lineItems.forEach(item => {
    priceLogSheet.appendRow([
      item.description,
      item.details,
      null, // item.quantity,
      null, // item.unit,
      null, //item.unitPrice,
      'EUR',
      item.totalPrice,
      purchaseId,
      // ... other columns in your priceLog
    ]);
  });
  Logger.log(`Loaded ${lineItems.length} items for purchase ID: ${purchaseId}`);
}

function getLastRowData(sheetData){
  return sheetData[sheetData.length -1]
}
