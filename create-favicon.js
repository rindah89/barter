const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createFavicon() {
  try {
    // Create a 192x192 canvas (good size for favicon)
    // with white background
    const size = 192;
    const backgroundColor = '#FFFFFF'; // White background

    // Create the background
    const background = Buffer.from(
      `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" fill="${backgroundColor}"/>
      </svg>`
    );

    // Read the logo
    const logoPath = path.join(__dirname, 'assets', 'logoipsum-225.png');
    const logo = await sharp(logoPath).toBuffer();

    // Get logo dimensions
    const logoMetadata = await sharp(logo).metadata();
    
    // Calculate the size for the logo (80% of the icon size)
    const logoSize = size * 0.8;
    const logoScale = logoSize / Math.max(logoMetadata.width, logoMetadata.height);
    const resizedLogoWidth = Math.round(logoMetadata.width * logoScale);
    const resizedLogoHeight = Math.round(logoMetadata.height * logoScale);

    // Resize the logo
    const resizedLogo = await sharp(logo)
      .resize(resizedLogoWidth, resizedLogoHeight)
      .toBuffer();

    // Calculate position to center the logo
    const logoLeft = Math.round((size - resizedLogoWidth) / 2);
    const logoTop = Math.round((size - resizedLogoHeight) / 2);

    // Composite the logo onto the background
    await sharp(background)
      .composite([
        {
          input: resizedLogo,
          top: logoTop,
          left: logoLeft,
        },
      ])
      .toFile(path.join(__dirname, 'assets', 'images', 'favicon.png'));

    console.log('Favicon created successfully!');
  } catch (error) {
    console.error('Error creating favicon:', error);
  }
}

createFavicon(); 