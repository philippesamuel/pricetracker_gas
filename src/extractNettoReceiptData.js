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
export function extractNettoReceiptData(emailBody) {

  const itemRegex = /<td style="font-size:.+>(.+?)<\/td>/;
  const priceRegex = /<td style="text-align:right;.+>(\d+,\d\d)&nbsp;<\/td>/;
  const itemDetailsRegex = /<td style="font-size:.+>&nbsp;&nbsp;&nbsp;&nbsp;(.*?)<\/td>/;
  const rowDividerRegex = /<hr .*\/><\/td>/;

  let storeAndPurchaseString = emailBody.split('Filiale:')[1].split('<!-- ZAHLUNGEN -->')[0];
  let storeAndPurchaseStringArray = storeAndPurchaseString.split('<!-- WARENKORB -->');
  const storeAddressRaw = storeAndPurchaseStringArray[0];
  Logger.log(storeAndPurchaseStringArray[1]);
  const lineItemsRaw = storeAndPurchaseStringArray[1].split('<!-- SUMME -->')[0];
  const addressRawArray = storeAddressRaw.split('\n').slice(1, 3);
  const lineItemsRawArray = lineItemsRaw.split('\n');

  let storeAddress = null;
  const lineItems = [];

  let currentLineItem = { description: null, totalPrice: null, details: null };
  let searchItem = false;
  let searchPrice = false;
  let searchDetail = false;


  // Extract store address
  Logger.log('parsing store address ...');
  const addressArrayClean = addressRawArray.map(s => s.replace('<br>', '').trim());
  storeAddress = addressArrayClean.join(', ');
  // Logger.log({storeAddress: storeAddress});
  let lineItemsFilteredArray = lineItemsRawArray.filter(function (line) {
    let stringsToRemove = ['', '<tr>', '</tr>', '<td>&nbsp;</td>', '<td></td>'];
    return !stringsToRemove.includes(line.trim());
  });

  // Extract line items
  Logger.log('parsing line items ...');
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

  return {
    storeAddress: storeAddress,
    lineItems: lineItems,
  };
}
