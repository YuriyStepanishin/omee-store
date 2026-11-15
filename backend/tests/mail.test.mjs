import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { mailConfigured, smtpOptions, sendResetEmail } from '../src/services/mail.js';
import { readEnv } from '../src/config/env.js';

const config = {
  smtpHost: 'smtp.gmail.com', smtpPort: 465,
  smtpUser: 'store@example.com', smtpPassword: 'test-app-password',
  mailFrom: 'store@example.com', storeUrl: 'https://example.com',
};

test('SMTP requires complete configuration and enforces encrypted transport', () => {
  assert.equal(mailConfigured(config), true);
  assert.equal(mailConfigured({...config,smtpPassword:''}), false);
  assert.equal(mailConfigured({...config,storeUrl:''}), false);
  assert.equal(mailConfigured({mailKey:'key',mailFrom:'store@example.com',storeUrl:'https://example.com'}), true);
  assert.equal(smtpOptions(config).secure,true);
  assert.equal(smtpOptions({...config,smtpPort:587}).requireTLS,true);
  assert.equal(smtpOptions({...config,smtpPort:587}).secure,false);
  assert.throws(()=>readEnv({SMTP_PORT:'25'}),/SMTP_PORT/);
});

test('SMTP sends recovery content and propagates rejection without provider fallback', async () => {
  const original = nodemailer.createTransport;
  let message;
  try {
    nodemailer.createTransport = options => {
      assert.equal(options.host,'smtp.gmail.com');
      assert.equal(options.auth.pass,'test-app-password');
      return {sendMail:async value=>{message=value;return {accepted:[value.to]};}};
    };
    await sendResetEmail('customer@example.com','https://example.com/reset-password#token',config);
    assert.equal(message.to,'customer@example.com');
    assert.equal(message.from,config.mailFrom);
    assert.ok(message.text.includes('https://example.com/reset-password#token'));
    assert.ok(!message.text.includes(config.smtpPassword));
    nodemailer.createTransport = () => ({sendMail:async()=>({accepted:[]})});
    await assert.rejects(()=>sendResetEmail('customer@example.com','https://example.com',config),/Mail delivery failed/);
  } finally {
    nodemailer.createTransport=original;
  }
});
