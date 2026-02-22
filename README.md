# TestMu AI SDET-1 Hackathon

## Overview

This project demonstrates an AI-driven QA automation framework using Playwright and LLM integration.

Goal:

Reduce time spent writing and debugging regression tests using AI assistance.

---

## Tech Stack

- Playwright (JavaScript)
- Node.js
- Google Gemini API
- Page Object Model (POM)

---

## Features

- Login module automation
- Dashboard automation tests
- REST API automation
- AI-powered failure explanation

---

## AI Integration

LLM is connected via Gemini API.

When tests fail:

- Error is sent to AI helper
- AI analyzes failure
- Provides explanation and debugging suggestions.

---

## How to Run

Install dependencies:

npm install

Run tests:

npx playwright test

View report:

npx playwright show-report