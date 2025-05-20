// Import the function for local testing (this is ignored in Google Apps Script)
let extractNettoReceiptData;
if (typeof require !== 'undefined') {
  const parser = require('../src/extractNettoReceiptData');
  extractNettoReceiptData = parser.extractNettoReceiptData;
}

// Create mock Logger for local testing
if (typeof Logger === 'undefined') {
  global.Logger = {
    log: function(message) {
      console.log(message);
    }
  };
}

runAllNettoReceiptTests()

// Test functions...
/**
 * Testing suite for extractNettoReceiptData function
 * Uses Google Apps Script's built-in testing capabilities
 */

/**
 * Master test function that runs all tests
 */
function runAllNettoReceiptTests() {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // Run all test functions
  testBasicReceipt(results);
  testEmptyReceipt(results);
  testMalformedReceipt(results);
  testMultipleItems(results);
  testSpecialCharacters(results);
  
  // Log summary
  Logger.log(`Tests completed: ${results.passed} passed, ${results.failed} failed`);
  results.tests.forEach(test => {
    Logger.log(`${test.passed ? '✓' : '✗'} ${test.name}: ${test.message}`);
  });
  
  return results;
}

/**
 * Helper function to add test result
 * @param {Object} results - The results object to update
 * @param {string} testName - Name of the test
 * @param {boolean} passed - Whether the test passed
 * @param {string} message - Message about the test result
 */
function recordTestResult(results, testName, passed, message) {
  results.tests.push({
    name: testName,
    passed: passed,
    message: message
  });
  
  if (passed) {
    results.passed++;
  } else {
    results.failed++;
  }
}

/**
 * Assert that two values are equal
 * @param {*} actual - Actual value
 * @param {*} expected - Expected value
 * @param {string} message - Message if assertion fails
 * @throws {Error} If assertion fails
 */
function assertEquals(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/**
 * Assert that a value is not null or undefined
 * @param {*} value - Value to check
 * @param {string} message - Message if assertion fails
 * @throws {Error} If assertion fails
 */
function assertNotNull(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to not be null or undefined');
  }
}

/**
 * Test with a basic, well-formed receipt
 * @param {Object} results - Test results object
 */
function testBasicReceipt(results) {
  const testName = 'Basic Receipt Test';
  
  try {
    // Create a simplified mock email body
    const mockEmailBody = `
      <html>
        <body>
          Filiale:
          <br>Netto City-Filiale
          <br>Hauptstr. 123, 12345 Berlin
          <!-- WARENKORB -->
          <table>
            <tr>
              <td style="font-size:12px;">Milch 3.5%</td>
            </tr>
            <tr>
              <td style="text-align:right;">1,29&nbsp;</td>
            </tr>
            <tr>
              <td style="font-size:10px;">&nbsp;&nbsp;&nbsp;&nbsp;1 Liter</td>
            </tr>
            <tr><td colspan="2"><hr /></td></tr>
            <tr>
              <td style="font-size:12px;">Brot</td>
            </tr>
            <tr>
              <td style="text-align:right;">2,49&nbsp;</td>
            </tr>
            <tr>
              <td style="font-size:10px;">&nbsp;&nbsp;&nbsp;&nbsp;500g</td>
            </tr>
          </table>
          <!-- SUMME -->
          <table>
            <tr>
              <td>Gesamtbetrag:</td>
              <td>3,78&nbsp;€</td>
            </tr>
          </table>
          <!-- ZAHLUNGEN -->
        </body>
      </html>
    `;
    
    const result = extractNettoReceiptData(mockEmailBody);
    
    // Test store address extraction
    assertNotNull(result.storeAddress, 'Store address should not be null');
    assertEquals(result.storeAddress.includes('Netto City-Filiale'), true, 'Store address should contain store name');
    
    // Test line items extraction
    assertEquals(result.lineItems.length, 2, 'Should extract 2 line items');
    assertEquals(result.lineItems[0].description, 'Milch 3.5%', 'First item should be Milch');
    assertEquals(result.lineItems[0].totalPrice, 1.29, 'First item price should be 1.29');
    assertEquals(result.lineItems[0].details, '1 Liter', 'First item details should be correct');
    
    recordTestResult(results, testName, true, 'Successfully parsed basic receipt');
  } catch (e) {
    recordTestResult(results, testName, false, `Failed: ${e.message}`);
  }
}

/**
 * Test with an empty receipt (no items)
 * @param {Object} results - Test results object
 */
function testEmptyReceipt(results) {
  const testName = 'Empty Receipt Test';
  
  try {
    // Create a mock email body with no items
    const mockEmailBody = `
      <html>
        <body>
          Filiale:
          <br>Netto City-Filiale
          <br>Berliner Str. 45, 10115 Berlin
          <!-- WARENKORB -->
          <!-- SUMME -->
          <table>
            <tr>
              <td>Gesamtbetrag:</td>
              <td>0,00&nbsp;€</td>
            </tr>
          </table>
          <!-- ZAHLUNGEN -->
        </body>
      </html>
    `;
    
    const result = extractNettoReceiptData(mockEmailBody);
    
    // Test store address extraction
    assertNotNull(result.storeAddress, 'Store address should not be null');
    
    // Test line items extraction
    assertEquals(result.lineItems.length, 0, 'Should extract 0 line items');
    
    recordTestResult(results, testName, true, 'Successfully handled empty receipt');
  } catch (e) {
    recordTestResult(results, testName, false, `Failed: ${e.message}`);
  }
}

/**
 * Test with a malformed receipt
 * @param {Object} results - Test results object
 */
function testMalformedReceipt(results) {
  const testName = 'Malformed Receipt Test';
  
  try {
    // Create a malformed mock email body
    const mockEmailBody = `
      <html>
        <body>
          Filiale:
          <br>Corrupted data
          <!-- DIFFERENT FORMAT -->
          <table>
            <tr>
              <td>Item 1</td>
              <td>1.99</td>
            </tr>
          </table>
        </body>
      </html>
    `;
    
    const result = extractNettoReceiptData(mockEmailBody);
    
    // We expect the function not to crash, but results may be incomplete
    assertNotNull(result, 'Should return a result object even for malformed input');
    
    recordTestResult(results, testName, true, 'Handled malformed receipt without crashing');
  } catch (e) {
    recordTestResult(results, testName, false, `Failed: ${e.message}`);
  }
}

/**
 * Test with multiple items including some with special formatting
 * @param {Object} results - Test results object
 */
function testMultipleItems(results) {
  const testName = 'Multiple Items Test';
  
  try {
    // Create a mock email body with multiple items
    const mockEmailBody = `
      <html>
        <body>
          Filiale:
          <br>Netto Marken-Discount
          <br>Musterstr. 42, 54321 München
          <!-- WARENKORB -->
          <table>
            <tr>
              <td style="font-size:12px;">Milch 3.5%</td>
            </tr>
            <tr>
              <td style="text-align:right;">1,29&nbsp;</td>
            </tr>
            <tr>
              <td style="font-size:10px;">&nbsp;&nbsp;&nbsp;&nbsp;1 Liter</td>
            </tr>
            <tr><td colspan="2"><hr /></td></tr>
            <tr>
              <td style="font-size:12px;">Brot</td>
            </tr>
            <tr>
              <td style="text-align:right;">2,49&nbsp;</td>
            </tr>
            <tr>
              <td style="font-size:10px;">&nbsp;&nbsp;&nbsp;&nbsp;500g</td>
            </tr>
            <tr><td colspan="2"><hr /></td></tr>
            <tr>
              <td style="font-size:12px;">Käse</td>
            </tr>
            <tr>
              <td style="text-align:right;">3,99&nbsp;</td>
            </tr>
            <tr>
              <td style="font-size:10px;">&nbsp;&nbsp;&nbsp;&nbsp;200g</td>
            </tr>
            <tr><td colspan="2"><hr /></td></tr>
            <tr>
              <td style="font-size:12px;">Wasser</td>
            </tr>
            <tr>
              <td style="text-align:right;">0,99&nbsp;</td>
            </tr>
            <tr>
              <td style="font-size:10px;">&nbsp;&nbsp;&nbsp;&nbsp;1,5 Liter</td>
            </tr>
          </table>
          <!-- SUMME -->
          <table>
            <tr>
              <td>Gesamtbetrag:</td>
              <td>8,76&nbsp;€</td>
            </tr>
          </table>
          <!-- ZAHLUNGEN -->
        </body>
      </html>
    `;
    
    const result = extractNettoReceiptData(mockEmailBody);
    
    // Test line items extraction
    assertEquals(result.lineItems.length, 4, 'Should extract 4 line items');
    assertEquals(result.lineItems[2].description, 'Käse', 'Third item should be Käse');
    assertEquals(result.lineItems[2].totalPrice, 3.99, 'Third item price should be 3.99');
    assertEquals(result.lineItems[3].details, '1,5 Liter', 'Fourth item details should have comma in number');
    
    recordTestResult(results, testName, true, 'Successfully parsed receipt with multiple items');
  } catch (e) {
    recordTestResult(results, testName, false, `Failed: ${e.message}`);
  }
}

/**
 * Test with special characters in store name and item descriptions
 * @param {Object} results - Test results object
 */
function testSpecialCharacters(results) {
  const testName = 'Special Characters Test';
  
  try {
    // Create a mock email body with special characters
    const mockEmailBody = `
      <html>
        <body>
          Filiale:
          <br>Netto München-Süd & Co. KG
          <br>Bahnhofstr. 7-9, 80335 München
          <!-- WARENKORB -->
          <table>
            <tr>
              <td style="font-size:12px;">Bio-Müsli & Nüsse</td>
            </tr>
            <tr>
              <td style="text-align:right;">4,99&nbsp;</td>
            </tr>
            <tr>
              <td style="font-size:10px;">&nbsp;&nbsp;&nbsp;&nbsp;750g</td>
            </tr>
            <tr><td colspan="2"><hr /></td></tr>
            <tr>
              <td style="font-size:12px;">Öllieferung (100% Öl)</td>
            </tr>
            <tr>
              <td style="text-align:right;">6,49&nbsp;</td>
            </tr>
            <tr>
              <td style="font-size:10px;">&nbsp;&nbsp;&nbsp;&nbsp;750ml</td>
            </tr>
          </table>
          <!-- SUMME -->
          <table>
            <tr>
              <td>Gesamtbetrag:</td>
              <td>11,48&nbsp;€</td>
            </tr>
          </table>
          <!-- ZAHLUNGEN -->
        </body>
      </html>
    `;
    
    const result = extractNettoReceiptData(mockEmailBody);
    
    // Test store address extraction with special characters
    assertNotNull(result.storeAddress, 'Store address should not be null');
    assertEquals(result.storeAddress.includes('München-Süd & Co. KG'), true, 'Store address should contain special characters');
    
    // Test line items with special characters
    assertEquals(result.lineItems.length, 2, 'Should extract 2 line items');
    assertEquals(result.lineItems[0].description, 'Bio-Müsli & Nüsse', 'First item should contain umlauts and ampersand');
    assertEquals(result.lineItems[1].description, 'Öllieferung (100% Öl)', 'Second item should contain percentage and parentheses');
    
    recordTestResult(results, testName, true, 'Successfully parsed receipt with special characters');
  } catch (e) {
    recordTestResult(results, testName, false, `Failed: ${e.message}`);
  }
}

/**
 * Mock the Logger object for testing
 * (Uncomment if not running in Google Apps Script environment)
 */
if (typeof Logger === 'undefined') {
  const Logger = {
    log: function(message) {
      console.log(message);
    }
  };
}
