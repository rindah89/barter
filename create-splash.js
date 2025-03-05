const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createSplashScreen() {
  try {
    // Create a 1242x2436 canvas (iPhone X dimensions, good for splash screens)
    // with white background
    const width = 1242;
    const height = 2436;
    const backgroundColor = '#FFFFFF'; // White background as requested

    // Create the background
    const background = Buffer.from(
      `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="${backgroundColor}"/>
      </svg>`
    );

    // Read the logo
    const logoPath = path.join(__dirname, 'assets', 'logoipsum-225.png');
    const logo = await sharp(logoPath).toBuffer();

    // Get logo dimensions
    const logoMetadata = await sharp(logo).metadata();
    
    // Calculate the size for the logo (40% of the smallest dimension)
    const logoSize = Math.min(width, height) * 0.4;
    const logoScale = logoSize / Math.max(logoMetadata.width, logoMetadata.height);
    const resizedLogoWidth = Math.round(logoMetadata.width * logoScale);
    const resizedLogoHeight = Math.round(logoMetadata.height * logoScale);

    // Resize the logo
    const resizedLogo = await sharp(logo)
      .resize(resizedLogoWidth, resizedLogoHeight)
      .toBuffer();

    // Calculate position to center the logo
    const logoLeft = Math.round((width - resizedLogoWidth) / 2);
    const logoTop = Math.round((height - resizedLogoHeight) / 2);

    // Composite the logo onto the background
    await sharp(background)
      .composite([
        {
          input: resizedLogo,
          top: logoTop,
          left: logoLeft,
        },
      ])
      .toFile(path.join(__dirname, 'assets', 'splash.png'));

    console.log('Splash screen created successfully!');
  } catch (error) {
    console.error('Error creating splash screen:', error);
  }
}

createSplashScreen(); 