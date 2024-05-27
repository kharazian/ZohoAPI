const fs = require('fs');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables at the start

// Centralized Environment Variable Access
const config = {
  clientId: process.env.ZOHO_CLIENT_ID,
  clientSecret: process.env.ZOHO_CLIENT_SECRET,
  code: process.env.ZOHO_AUTH_CODE,
  organizationName: process.env.ZOHO_ORG_NAME,
  applicationName: process.env.ZOHO_APP_NAME,
  FormLinkName: process.env.ZOHO_FORM_NAME,
  reportLinkName: process.env.ZOHO_REPORT_NAME,
  accessToken: process.env.ZOHO_ACCESS_TOKEN,
  tokenExpirationTime: process.env.ZOHO_TOKEN_EXPIRATION_TIME,
  refreshToken: process.env.ZOHO_REFRESH_TOKEN
};

// Error Handling Helper
async function handleError(error) {
  if (error.response) {
    console.error("Error Response Data:", error.response.data);
  }
  console.error("Error:", error.message); // Log the error message
  // Consider adding more sophisticated error handling logic here (e.g., retrying, alerting, etc.)
}

// Helper Function to Check Token Expiration
function isTokenExpired() {
  if (!config.tokenExpirationTime) return true; // Expired if not set
  return Date.now() >= config.tokenExpirationTime;
}

function updateEnvVariable(key, value) {
  const envFilePath = '.env'; // Assuming .env is in your project root
  const envConfig = dotenv.parse(fs.readFileSync(envFilePath));

  envConfig[key] = value; // Update or add the key-value pair

  const newEnvContent = Object.entries(envConfig)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync(envFilePath, newEnvContent);
}

// Improved Token Generation
async function generateAccessToken() {
  try {
    const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
      params: {
        grant_type: 'authorization_code',
        code: config.code, 
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    });
    // Update stored access token after generation
    config.accessToken = response.data.access_token;
    updateEnvVariable('ZOHO_ACCESS_TOKEN', response.data.access_token);
    config.refreshToken = response.data.refresh_token;
    updateEnvVariable('ZOHO_REFRESH_TOKEN', response.data.refresh_token);
    config.tokenExpirationTime = Date.now() + (response.data.expires_in * 1000);
    updateEnvVariable('ZOHO_TOKEN_EXPIRATION_TIME', config.tokenExpirationTime);
    return config.accessToken;
  } catch (error) {
    handleError(error);
    return null; // Indicate failure 
  }
}

// Improved Token Management
async function getAccessToken() {
  try {
    if (config.accessToken && !isTokenExpired()) {
      return config.accessToken; // Use existing token if available
    }

    if (config.refreshToken) {  
      const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
        params: {
          grant_type: 'refresh_token',
          refresh_token: config.refreshToken,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        },
      });

      // Update stored access token after refresh
      config.accessToken = response.data.access_token;
      updateEnvVariable('ZOHO_ACCESS_TOKEN', response.data.access_token);      
      config.tokenExpirationTime = Date.now() + (response.data.expires_in * 1000);
      updateEnvVariable('ZOHO_TOKEN_EXPIRATION_TIME', config.tokenExpirationTime);
      return config.accessToken;
    }
    return generateAccessToken();

  } catch (error) {
    handleError(error);
    return null; // Indicate failure
  }
}

// Fetch Data (Simplified)
async function fetchData() {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    console.error("Failed to obtain access token.");
    return;
  }
  const url = `https://creator.zoho.com/api/v2/${config.organizationName}/${config.applicationName}/report/${config.reportLinkName}`
  try {
    const response = await axios.get(
      url,
      { params: { criteria: 'Personal_Email_ID == \"amirkharazian@gmail.com\"' } 
      , headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } },  
    );
    
    const record = await axios.get(
      `${url}/${response.data.data[0]['ID']}`,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } },
    );

    const update = await axios.patch(
      `${url}/${response.data.data[0]['ID']}`,
      {
        "data": { "Company_Name":"CRM" }
      },
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } },
    );

    console.log(update);
    // ... (data processing)
  } catch (error) {
    handleError(error);
  }
}

fetchData();