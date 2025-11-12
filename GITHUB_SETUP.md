# GitHub Repository Setup

## Step 1: Create Repository on GitHub

1. Go to https://github.com/new
2. Repository name: `saahomes.com`
3. Description: "SAA Homes real estate website with backend API"
4. Choose Public or Private
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

## Step 2: Push to GitHub

After creating the repo, run these commands:

```bash
git remote add origin https://github.com/YOUR_USERNAME/saahomes.com.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

## Alternative: If you want to use SSH

```bash
git remote add origin git@github.com:YOUR_USERNAME/saahomes.com.git
git push -u origin main
```

## Railway Deployment

After pushing to GitHub:
1. Go to Railway dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `saahomes.com` repository
5. Railway will detect the backend folder and deploy it

