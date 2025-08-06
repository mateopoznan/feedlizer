#!/usr/bin/env node

// Debug Instapaper OAuth signature
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret = '') {
    console.log('=== OAuth Signature Debug ===');
    console.log('Method:', method);
    console.log('URL:', url);
    console.log('Params:', params);
    console.log('Consumer Secret:', consumerSecret ? '***' : null);
    console.log('Token Secret:', tokenSecret ? '***' : null);
    
    const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');
    
    console.log('Sorted params:', sortedParams);

    const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
    console.log('Base string:', baseString);
    
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
    console.log('Signing key:', signingKey);
    
    const signature = crypto
        .createHmac('sha1', signingKey)
        .update(baseString)
        .digest('base64');
    
    console.log('Generated signature:', signature);
    return signature;
}

async function debugInstapaper() {
    const consumerKey = process.env.INSTAPAPER_CONSUMER_KEY;
    const consumerSecret = process.env.INSTAPAPER_CONSUMER_SECRET;
    const username = process.env.INSTAPAPER_USERNAME;
    const password = process.env.INSTAPAPER_PASSWORD;

    console.log('=== Credentials ===');
    console.log('Consumer Key:', consumerKey);
    console.log('Consumer Secret:', consumerSecret ? '***' : null);
    console.log('Username:', username);
    console.log('Password:', password ? '***' : null);

    try {
        // Step 1: Get token
        console.log('\n=== Step 1: Getting OAuth Token ===');
        
        const oauthParams = {
            oauth_consumer_key: consumerKey,
            oauth_nonce: 'test-nonce-123',
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: '1234567890',
            oauth_version: '1.0'
        };

        const tokenRequestParams = {
            ...oauthParams,
            x_auth_mode: 'client_auth',
            x_auth_username: username,
            x_auth_password: password
        };

        const tokenSignature = generateOAuthSignature(
            'POST',
            'https://www.instapaper.com/api/1/oauth/access_token',
            tokenRequestParams,
            consumerSecret
        );

        tokenRequestParams.oauth_signature = tokenSignature;

        console.log('\n=== Token Request ===');
        const tokenPayload = new URLSearchParams(tokenRequestParams).toString();
        console.log('Payload:', tokenPayload);

        const tokenResponse = await axios.post(
            'https://www.instapaper.com/api/1/oauth/access_token',
            tokenPayload,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        console.log('Token Response Status:', tokenResponse.status);
        console.log('Token Response Data:', tokenResponse.data);

        const tokenData = new URLSearchParams(tokenResponse.data);
        const oauthToken = tokenData.get('oauth_token');
        const oauthTokenSecret = tokenData.get('oauth_token_secret');

        // Step 2: Add bookmark with SIMPLE params
        console.log('\n=== Step 2: Adding Simple Bookmark ===');
        
        const bookmarkParams = {
            oauth_consumer_key: consumerKey,
            oauth_nonce: 'test-nonce-456',
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: '1234567891',
            oauth_version: '1.0',
            oauth_token: oauthToken,
            url: 'https://example.com',
            title: 'Test Article'
        };

        const bookmarkSignature = generateOAuthSignature(
            'POST',
            'https://www.instapaper.com/api/1/bookmarks/add',
            bookmarkParams,
            consumerSecret,
            oauthTokenSecret
        );

        bookmarkParams.oauth_signature = bookmarkSignature;

        console.log('\n=== Bookmark Request ===');
        const bookmarkPayload = new URLSearchParams(bookmarkParams).toString();
        console.log('Payload:', bookmarkPayload);

        const bookmarkResponse = await axios.post(
            'https://www.instapaper.com/api/1/bookmarks/add',
            bookmarkPayload,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        console.log('Bookmark Response Status:', bookmarkResponse.status);
        console.log('Bookmark Response Data:', bookmarkResponse.data);

    } catch (error) {
        console.log('\n=== ERROR ===');
        console.log('Status:', error.response?.status);
        console.log('Status Text:', error.response?.statusText);
        console.log('Data:', error.response?.data);
        console.log('Headers:', error.response?.headers);
    }
}

debugInstapaper().catch(console.error);
