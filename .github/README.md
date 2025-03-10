# GitHub Actions Setup Instructions

This directory contains GitHub Actions workflow files that have been temporarily disabled. Follow these steps to enable them after pushing your repository to GitHub:

## Step 1: Push to GitHub
First, push your repository to GitHub.

## Step 2: Set up Vercel Integration
1. Go to [Vercel](https://vercel.com/dashboard)
2. Click "Add New" and select "Project"
3. Import your GitHub repository
4. Configure your project settings and deploy

## Step 3: Get Vercel Credentials
1. **Vercel Token**:
   - Go to https://vercel.com/account/tokens
   - Create a new token and copy it

2. **Org ID and Project ID**:
   - Install Vercel CLI: `npm i -g vercel` or `bun install -g vercel`
   - Run `vercel link` in your project directory to link to your Vercel project
   - Check the `.vercel/project.json` file that gets created for your Project ID
   - Run `vercel whoami` to get your Org ID (shown as username or team name)

## Step 4: Add GitHub Secrets
1. Go to your GitHub repository → Settings → Secrets and variables → Actions
2. Add the following secrets:
   - `VERCEL_TOKEN`: Your Vercel API token
   - `VERCEL_ORG_ID`: Your Vercel organization ID
   - `VERCEL_PROJECT_ID`: Your Vercel project ID

## Step 5: Enable Workflows
1. Uncomment the `on:` section in each workflow file:
   - `.github/workflows/ci.yml`
   - `.github/workflows/deploy.yml`
   - `.github/workflows/preview.yml`
2. Commit and push the changes

Your GitHub Actions workflows will now be active! 