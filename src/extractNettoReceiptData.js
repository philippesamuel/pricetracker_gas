/**
 * Extract data from the HTML body of a Netto receipt email.
 * Parse store address and individual line items with their prices and details.
 *
 * @param {string} emailBody - The HTML content of the Netto receipt email.
 * @returns {object} An object containing the extracted store address and an array of line items.
 * @returns {string|null} return.storeAddress - The extracted store address, or null if not found.
 * @returns {Array<object>} return.lineItems - An array of extracted line item objects.
 * @returns {string|null} return.lineItems[].description - The name or main description of the item.
 * @returns {number|null} return.lineItems[].totalPrice - The total price of the item.
 * @returns {string|null} return.lineItems[].details - Additional details or sub-description of the item.
 */
function extractNettoReceiptData(emailBody) {

  const { storeAddressRaw, lineItemsRaw } = extractStoreAndPurchaseString(emailBody, 'Filiale:', '<!-- ZAHLUNGEN -->', '<!-- SUMME -->');

  // Extract store address
  Logger.log('parsing store address ...');
  const storeAddress = extractStoreAddress(storeAddressRaw);

  // Extract line items
  Logger.log('parsing line items ...');
  let lineItems = extractLineItems(lineItemsRaw);
  return {
    storeAddress: storeAddress,
    lineItems: lineItems,
  };
}

/**
* Extracts a substring from the email body between two specified strings.
* 
* @param {string} emailBody - The HTML content of the email.
* @param {string} startString - The string to start the extraction from.
* @param {string} middleString - The string to split the extraction.
* @param {string} endString - The string to end the extraction at.
* @returns {object} An object containing the extracted store address and line items.
* @returns {string} return.storeAddressRaw - The raw store address string.
* @returns {string} return.lineItemsRaw - The raw line items string.
* 
*/
function extractStoreAndPurchaseString(emailBody, startString = 'Filiale:', middleString = '<!-- WARENKORB -->', endString = '<!-- SUMME -->') {
  const storeAndPurchaseString = emailBody.split(startString)[1].split(endString)[0];
  const storeAndPurchaseStringArray = storeAndPurchaseString.split(middleString);
  return { storeAddressRaw: storeAndPurchaseStringArray[0], lineItemsRaw: storeAndPurchaseStringArray[1] };
}

function extractStoreAddress(storeAddressRaw) {
  const addressRawArray = storeAddressRaw.split('\n').slice(1, 3);
  const addressArrayClean = addressRawArray.map(s => s.replace('<br>', '').trim());
  return addressArrayClean.join(', ');
}

function extractLineItems(lineItemsRaw) {
  const itemRegex = /<td style="font-size:.+>(.+?)<\/td>/;
  const priceRegex = /<td style="text-align:right;.+>(\d+,\d\d)&nbsp;<\/td>/;
  const itemDetailsRegex = /<td style="font-size:.+>&nbsp;&nbsp;&nbsp;&nbsp;(.*?)<\/td>/;
  const rowDividerRegex = /<hr .*\/><\/td>/;

  const lineItems = [];
  lineItemsFilteredArray = extractLineItemsArray(lineItemsRaw);

  let currentLineItem = { description: null, totalPrice: null, details: null };
  let searchItem = false;
  let searchPrice = false;
  let searchDetail = false;

  for (const line of lineItemsFilteredArray) {
    // Logger.log(line);
    const dividerMatch = line.match(rowDividerRegex);
    if (dividerMatch) {
      if (currentLineItem.description || currentLineItem.totalPrice || currentLineItem.details) {
        lineItems.push({ ...currentLineItem }); // Create a copy
      }
      currentLineItem = { description: null, totalPrice: null, details: null };
      searchItem = true;
      searchPrice = false;
      searchDetail = false;
      continue;
    }

    if (searchItem) {
      const itemMatch = line.match(itemRegex);
      if (itemMatch) {
        currentLineItem.description = itemMatch[1].trim();
        // Logger.log({ description: currentLineItem.description });
        searchItem = false;
        searchPrice = true;
        continue;
      }
    }

    if (searchPrice) {
      const priceMatch = line.match(priceRegex);
      if (priceMatch) {
        const priceStr = priceMatch[1].trim().replace(',', '.');
        currentLineItem.totalPrice = parseFloat(priceStr);
        // Logger.log({ totalPrice: currentLineItem.totalPrice });
        searchPrice = false;
        searchDetail = true;
        continue;
      }
    }

    if (searchDetail) {
      const detailMatch = line.match(itemDetailsRegex);
      if (detailMatch) {
        currentLineItem.details = detailMatch[1].trim();
        // Logger.log({ details: currentLineItem.details });
        searchDetail = false;
      }
    }
  }

  // Push the last item if it has data
  if (currentLineItem.description || currentLineItem.totalPrice || currentLineItem.details) {
    lineItems.push({ ...currentLineItem });
  }

  return lineItems;
}

function extractLineItemsArray(lineItemsRaw) {
  const lineItemsRawArray = lineItemsRaw.split('\n');
  let lineItemsFilteredArray = lineItemsRawArray.filter(function (line) {
    let stringsToRemove = ['', '<tr>', '</tr>', '<td>&nbsp;</td>', '<td></td>'];
    return !stringsToRemove.includes(line.trim());
  });
  return lineItemsFilteredArray;
}
