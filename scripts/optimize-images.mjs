#!/usr/bin/env node
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.join(__dirname, '../public/images');

const imagesToOptimize = [
  'hero-krishoe-gold-v2.png',
  'hero-banner.png',
  'logo.png',
  'mobile-hero-krishoe-gold-v2.png',
];

async function optimizeImage(filename) {
  const inputPath = path.join(imagesDir, filename);
  const outputPath = path.join(imagesDir, filename);

  if (!fs.existsSync(inputPath)) {
    console.log(`❌ File not found: ${filename}`);
    return;
  }

  const inputSize = fs.statSync(inputPath).size;

  try {
    // Optimize PNG: reduce colors, quality, strip metadata
    await sharp(inputPath)
      .png({
        quality: 85,
        progressive: true,
        adaptiveFiltering: true,
      })
      .toFile(outputPath + '.temp');

    // Get optimized file size
    const outputSize = fs.statSync(outputPath + '.temp').size;
    const reduction = ((1 - outputSize / inputSize) * 100).toFixed(1);

    // Replace original
    fs.renameSync(outputPath + '.temp', outputPath);

    console.log(`✅ ${filename}`);
    console.log(`   Before: ${(inputSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   After:  ${(outputSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Reduction: ${reduction}%\n`);

    return { filename, before: inputSize, after: outputSize, reduction: parseFloat(reduction) };
  } catch (error) {
    console.error(`❌ Error optimizing ${filename}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🖼️  KRISHOE Image Optimization');
  console.log('===============================\n');

  const results = [];
  for (const filename of imagesToOptimize) {
    const result = await optimizeImage(filename);
    if (result) results.push(result);
  }

  if (results.length > 0) {
    const totalBefore = results.reduce((sum, r) => sum + r.before, 0);
    const totalAfter = results.reduce((sum, r) => sum + r.after, 0);
    const totalReduction = ((1 - totalAfter / totalBefore) * 100).toFixed(1);

    console.log('📊 Summary');
    console.log('===========');
    console.log(`Total Before: ${(totalBefore / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total After:  ${(totalAfter / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total Reduction: ${totalReduction}%\n`);
    console.log(`✨ Savings: ${((totalBefore - totalAfter) / 1024 / 1024).toFixed(2)} MB`);
  }
}

main().catch(console.error);
