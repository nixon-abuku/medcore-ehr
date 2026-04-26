/**
 * MedCore Mirth Channel Setup
 *
 * LEARNING: This script configures Mirth Connect via its REST API.
 * In production, integration engineers export/import channel configs.
 * This script creates all 4 channels programmatically so you can
 * see exactly what each channel does.
 *
 * The 4 channels we create:
 *
 * 1. ADT_Inbound — receives ADT messages, logs them, fans out
 * 2. Lab_Orders_Out — routes ORM^O01 lab orders to mock lab
 * 3. Lab_Results_In — receives ORU^R01 from mock lab, routes to EHR
 * 4. Pharmacy_Orders_Out — routes RDE^O11 to mock pharmacy
 * 5. Radiology_Orders_Out — routes ORM^O01 imaging to mock radiology
 */

const https = require('https');
const http  = require('http');

const MIRTH_HOST = process.env.MIRTH_HOST || 'localhost';
const MIRTH_PORT = process.env.MIRTH_HTTPS_PORT || 8443;
const MIRTH_USER = 'admin';
const MIRTH_PASS = 'admin';

// Ignore self-signed cert
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function mirthRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: MIRTH_HOST,
      port: MIRTH_PORT,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${MIRTH_USER}:${MIRTH_PASS}`).toString('base64'),
      },
      rejectUnauthorized: false,
    };
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Channel XML templates ─────────────────────────────────────
function buildChannel(id, name, description, sourceConnector, destinationConnectors) {
  return {
    id,
    name,
    description,
    enabled: true,
    sourceConnector,
    destinationConnectors,
    properties: {
      '@class': 'com.mirth.connect.donkey.model.channel.ChannelProperties',
      clearGlobalChannelMap: true,
      messageStorageMode: 'DEVELOPMENT',
      encryptData: false,
      removeContentOnCompletion: false,
      removeOnlyFilteredOnCompletion: false,
      removeAttachmentsOnCompletion: false,
      initialState: 'STARTED',
      storeAttachments: true,
    },
  };
}

// ── Channel Definitions ───────────────────────────────────────

function buildMLLPSource(name, port, description) {
  return {
    '@class': 'com.mirth.connect.donkey.model.channel.SourceConnector',
    name,
    enabled: true,
    transportName: 'TCP Listener',
    description,
    properties: {
      '@class': 'com.mirth.connect.connectors.tcp.TcpReceiverProperties',
      listenerConnectorProperties: {
        host: '0.0.0.0',
        port: String(port),
      },
      transmissionModeProperties: {
        '@class': 'com.mirth.connect.model.transmission.framemode.FrameModeProperties',
        pluginPointName: 'MLLP',
        startOfMessageBytes: '0B',
        endOfMessageBytes: '1C0D',
      },
      serverMode: true,
      remoteAddress: '',
      remotePort: '',
      overrideLocalBinding: false,
      reconnectInterval: '5000',
      receiveTimeout: '0',
      bufferSize: '65536',
      maxConnections: '10',
      keepConnectionOpen: true,
      dataTypeBinary: false,
      charsetEncoding: 'DEFAULT_ENCODING',
      respondOnNewConnection: '0',
      responseAddress: '',
      responsePort: '',
    },
    transformer: buildTransformer('source'),
    filter: { '@class': 'com.mirth.connect.donkey.model.channel.FilterTransformer', elements: [] },
    responseTransformer: buildTransformer('response'),
  };
}

function buildMLLPDestination(name, host, port, description, transformer) {
  return {
    '@class': 'com.mirth.connect.donkey.model.channel.DestinationConnector',
    name,
    enabled: true,
    transportName: 'TCP Sender',
    description,
    waitForPrevious: true,
    properties: {
      '@class': 'com.mirth.connect.connectors.tcp.TcpSenderProperties',
      remoteAddress: host,
      remotePort: String(port),
      overrideLocalBinding: false,
      reconnectInterval: '5000',
      sendTimeout: '10000',
      bufferSize: '65536',
      maxConnections: '1',
      keepConnectionOpen: false,
      checkRemoteHost: false,
      dataTypeBinary: false,
      charsetEncoding: 'DEFAULT_ENCODING',
      transmissionModeProperties: {
        '@class': 'com.mirth.connect.model.transmission.framemode.FrameModeProperties',
        pluginPointName: 'MLLP',
        startOfMessageBytes: '0B',
        endOfMessageBytes: '1C0D',
      },
      template: '${message.encodedData}',
    },
    transformer: transformer || buildTransformer('destination'),
    filter: buildFilter(),
    responseTransformer: buildTransformer('response'),
  };
}

function buildTransformer(type, steps = []) {
  return {
    '@class': 'com.mirth.connect.donkey.model.channel.FilterTransformer',
    elements: steps,
    inboundDataType: 'HL7V2',
    outboundDataType: 'HL7V2',
    inboundProperties: { '@class': 'com.mirth.connect.plugins.datatypes.hl7v2.HL7v2DataTypeProperties' },
    outboundProperties: { '@class': 'com.mirth.connect.plugins.datatypes.hl7v2.HL7v2DataTypeProperties' },
  };
}

function buildFilter(rules = []) {
  return {
    '@class': 'com.mirth.connect.donkey.model.channel.FilterTransformer',
    elements: rules,
  };
}

function buildJSStep(name, script) {
  return {
    '@class': 'com.mirth.connect.plugins.javascriptstep.JavaScriptStep',
    name,
    script,
  };
}

function buildMessageTypeFilter(messageType, eventCode) {
  // Filter: only pass messages where MSH-9.1 = messageType AND MSH-9.2 = eventCode
  return {
    '@class': 'com.mirth.connect.donkey.model.channel.FilterTransformer',
    elements: [{
      '@class': 'com.mirth.connect.plugins.rulebuilder.RuleBuilderRule',
      name: `Accept ${messageType}^${eventCode}`,
      operator: 'AND',
      rules: [{
        '@class': 'com.mirth.connect.plugins.rulebuilder.DataTypeRule',
        field: `msg['MSH']['MSH.9']['MSH.9.1'].toString() + '^' + msg['MSH']['MSH.9']['MSH.9.2'].toString()`,
        operator: 'EQUALS',
        value: `${messageType}^${eventCode}`,
      }],
    }],
  };
}

// ── Setup function ────────────────────────────────────────────
async function setupChannels() {
  console.log('Connecting to Mirth Connect REST API...');

  // Test connection
  const test = await mirthRequest('GET', '/server/version');
  if (test.status !== 200) {
    console.error('Could not connect to Mirth. Status:', test.status);
    console.error('Make sure Mirth is running at', MIRTH_HOST + ':' + MIRTH_PORT);
    process.exit(1);
  }
  console.log('Connected to Mirth', test.body);

  const channels = [
    // ── Channel 1: ADT Inbound ──────────────────────────────
    {
      id: 'aaaa-1111-adtinbound-0001',
      name: 'ADT_Inbound',
      description: 'Receives all ADT messages from MedCore EHR on port 6661. Logs and fans out to downstream systems.',
      sourceConnector: buildMLLPSource('ADT Source', 6661, 'MLLP listener for ADT messages'),
      destinationConnectors: [
        {
          ...buildMLLPDestination('Log to DB', 'localhost', 7000, 'Log ADT events',
            buildTransformer('destination', [
              buildJSStep('Log ADT Event',
                `// LEARNING: This is a Mirth JavaScript transformer
// msg = the HL7 message object
// We can read any field using msg['SEGMENT']['SEGMENT.FIELD']['SEGMENT.FIELD.COMPONENT']

var msgType = msg['MSH']['MSH.9']['MSH.9.1'].toString();
var eventCode = msg['MSH']['MSH.9']['MSH.9.2'].toString();
var mrn = msg['PID']['PID.3']['PID.3.1'].toString();
var patientName = msg['PID']['PID.5']['PID.5.1'].toString() + ', ' + msg['PID']['PID.5']['PID.5.2'].toString();

logger.info('ADT Message: ' + msgType + '^' + eventCode + ' | MRN: ' + mrn + ' | Patient: ' + patientName);

// Store in channel map for routing decisions
channelMap.put('msgType', msgType);
channelMap.put('eventCode', eventCode);
channelMap.put('mrn', mrn);`)
            ])
          ),
          name: 'Log ADT Event',
        },
      ],
    },

    // ── Channel 2: Lab Orders Out ────────────────────────────
    {
      id: 'aaaa-2222-laborders-0001',
      name: 'Lab_Orders_Out',
      description: 'Routes ORM^O01 lab orders from MedCore to Mock Lab (LIS) on port 6662.',
      sourceConnector: buildMLLPSource('Lab Order Source', 6661, 'Receives ORM lab orders'),
      destinationConnectors: [
        {
          ...buildMLLPDestination('Send to Mock Lab', 'mock-lab', 6662, 'Forward to LIS',
            buildTransformer('destination', [
              buildJSStep('Route Lab Order',
                `// LEARNING: This transformer reads the ORM message and
// adds the filler application name before forwarding to the lab
// In real Epic Bridges, this is where you'd map Epic order codes
// to the lab's internal codes

var placerOrderNum = msg['ORC']['ORC.2']['ORC.2.1'].toString();
var testCode = msg['OBR']['OBR.4']['OBR.4.1'].toString();
var testName = msg['OBR']['OBR.4']['OBR.4.2'].toString();
var priority = msg['OBR']['OBR.5'].toString();
var mrn = msg['PID']['PID.3']['PID.3.1'].toString();

logger.info('Lab Order: ' + placerOrderNum + ' | Test: ' + testCode + ' (' + testName + ') | Priority: ' + priority + ' | MRN: ' + mrn);

// Set MSH-5 (receiving application) to mock lab
msg['MSH']['MSH.5']['MSH.5.1'] = 'MOCK_LAB';
msg['MSH']['MSH.6']['MSH.6.1'] = 'LIS_SYSTEM';

// Add processing note
channelMap.put('routedTo', 'MOCK_LAB');
channelMap.put('orderNum', placerOrderNum);`)
            ])
          ),
          name: 'Forward to Mock Lab',
        },
      ],
    },

    // ── Channel 3: Lab Results In ────────────────────────────
    {
      id: 'aaaa-3333-labresults-0001',
      name: 'Lab_Results_In',
      description: 'Receives ORU^R01 results from Mock Lab, routes back to MedCore EHR.',
      sourceConnector: buildMLLPSource('ORU Source', 6661, 'Receives ORU results from lab'),
      destinationConnectors: [
        {
          ...buildMLLPDestination('Send to EHR', 'gateway', 3001, 'Route result to MedCore',
            buildTransformer('destination', [
              buildJSStep('Process Lab Result',
                `// LEARNING: This is the result transformer
// When the mock lab sends back ORU^R01, this runs
// We extract the key fields integration engineers care about

var placerOrderNum = msg['OBR']['OBR.2']['OBR.2.1'].toString();
var fillerOrderNum = msg['OBR']['OBR.3']['OBR.3.1'].toString();
var mrn = msg['PID']['PID.3']['PID.3.1'].toString();

// Check for critical values in any OBX segment
var hasCritical = false;
var criticalTests = [];

for (var i = 0; i < msg['OBX'].length(); i++) {
  var flag = msg['OBX'][i]['OBX.8'].toString();
  var testName = msg['OBX'][i]['OBX.3']['OBX.3.2'].toString();
  var value = msg['OBX'][i]['OBX.5'].toString();

  if (flag === 'HH' || flag === 'LL') {
    hasCritical = true;
    criticalTests.push(testName + '=' + value + ' (' + flag + ')');
    logger.error('CRITICAL VALUE: ' + testName + '=' + value + ' Flag=' + flag + ' MRN=' + mrn);
  }
}

if (hasCritical) {
  logger.error('CRITICAL RESULT for MRN ' + mrn + ': ' + criticalTests.join(', '));
  // In production: trigger alert workflow, page provider
}

logger.info('Result received: Placer=' + placerOrderNum + ' Filler=' + fillerOrderNum + ' MRN=' + mrn + ' Critical=' + hasCritical);
channelMap.put('hasCritical', hasCritical);
channelMap.put('mrn', mrn);`)
            ])
          ),
          name: 'Process and Forward Result',
        },
      ],
    },

    // ── Channel 4: Pharmacy Orders Out ──────────────────────
    {
      id: 'aaaa-4444-pharmacy-00001',
      name: 'Pharmacy_Orders_Out',
      description: 'Routes RDE^O11 medication orders to Mock Pharmacy on port 6663.',
      sourceConnector: buildMLLPSource('RDE Source', 6661, 'Receives RDE medication orders'),
      destinationConnectors: [
        {
          ...buildMLLPDestination('Send to Mock Pharmacy', 'mock-pharmacy', 6663, 'Forward to pharmacy',
            buildTransformer('destination', [
              buildJSStep('Route Med Order',
                `// LEARNING: Medication order transformer
// RDE^O11 has RXO segment instead of OBR
// The drug code and dose live in different places than lab orders

var placerOrderNum = msg['ORC']['ORC.2']['ORC.2.1'].toString();
var mrn = msg['PID']['PID.3']['PID.3.1'].toString();
var drugCode = msg['RXO']['RXO.1']['RXO.1.1'].toString();
var drugName = msg['RXO']['RXO.1']['RXO.1.2'].toString();
var dose = msg['RXO']['RXO.2'].toString();
var doseUnit = msg['RXO']['RXO.4'].toString();
var route = msg['RXO']['RXO.5'].toString();
var frequency = msg['RXO']['RXO.7'].toString();

logger.info('Med Order: ' + drugName + ' ' + dose + doseUnit + ' ' + route + ' ' + frequency + ' | MRN: ' + mrn);

// Update receiving application
msg['MSH']['MSH.5']['MSH.5.1'] = 'MOCK_PHARMACY';
channelMap.put('drug', drugName);
channelMap.put('orderNum', placerOrderNum);`)
            ])
          ),
          name: 'Forward to Mock Pharmacy',
        },
      ],
    },

    // ── Channel 5: Radiology Orders Out ─────────────────────
    {
      id: 'aaaa-5555-radiology-0001',
      name: 'Radiology_Orders_Out',
      description: 'Routes ORM^O01 imaging orders to Mock Radiology (RIS) on port 6664.',
      sourceConnector: buildMLLPSource('Rad Order Source', 6661, 'Receives ORM imaging orders'),
      destinationConnectors: [
        {
          ...buildMLLPDestination('Send to Mock Radiology', 'mock-radiology', 6664, 'Forward to RIS',
            buildTransformer('destination', [
              buildJSStep('Route Imaging Order',
                `// LEARNING: Radiology order transformer
// Same ORM^O01 format as lab, but routed to radiology
// In production you'd check OBR-24 (diagnostic service section)
// to determine if it's LAB, RAD, or other

var placerOrderNum = msg['ORC']['ORC.2']['ORC.2.1'].toString();
var mrn = msg['PID']['PID.3']['PID.3.1'].toString();
var modality = msg['OBR']['OBR.4']['OBR.4.1'].toString();
var studyName = msg['OBR']['OBR.4']['OBR.4.2'].toString();
var priority = msg['OBR']['OBR.5'].toString();
var indication = msg['OBR']['OBR.13'].toString();

logger.info('Imaging Order: ' + studyName + ' (' + modality + ') Priority: ' + priority + ' | MRN: ' + mrn + ' | Indication: ' + indication);

msg['MSH']['MSH.5']['MSH.5.1'] = 'MOCK_RADIOLOGY';
channelMap.put('study', studyName);
channelMap.put('orderNum', placerOrderNum);`)
            ])
          ),
          name: 'Forward to Mock Radiology',
        },
      ],
    },
  ];

  // Deploy each channel
  for (const channel of channels) {
    console.log(`\nDeploying channel: ${channel.name}...`);
    const result = await mirthRequest('POST', '/channels', channel);
    if (result.status === 200 || result.status === 201) {
      console.log(`✅ ${channel.name} created`);
      // Start the channel
      await mirthRequest('POST', `/channels/${channel.id}/_start`);
      console.log(`✅ ${channel.name} started`);
    } else {
      console.log(`⚠️  ${channel.name} - Status ${result.status}:`, typeof result.body === 'string' ? result.body.substring(0,200) : JSON.stringify(result.body).substring(0,200));
    }
  }

  console.log('\n✅ Mirth channel setup complete!');
  console.log('Open https://localhost:8444 to see your channels in the Mirth admin UI.');
}

setupChannels().catch(e => {
  console.error('Setup failed:', e.message);
  process.exit(1);
});
