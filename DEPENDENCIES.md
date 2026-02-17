# Dependency Management

This plugin uses vendored JavaScript libraries that are managed through npm for easier updates.

## Current Dependencies

The plugin includes the following JavaScript libraries:

- **jQuery**: v3.7.1 (updated from v1.12.3, v2.2.3, v3.1.0)
- **moment.js**: v2.30.1 (updated from v2.20.1)
- **vis.js**: v4.21.0 (monolithic version, currently in use)
- **vis-network**: v9.1.9 (modern replacement for network visualization, available for future migration)
- **vis-timeline**: v7.7.3 (modern replacement for timeline visualization, available for future migration)

## Updating Dependencies

To update the JavaScript dependencies:

1. Install Node.js and npm if not already installed
2. Run `npm install` to install the dependencies specified in package.json
3. Run `npm run copy-deps` to copy the updated files to their proper locations
4. Test the plugin to ensure compatibility

## Manual Updates

If you need to update a specific dependency:

1. Edit `package.json` and update the version number
2. Run `npm install`
3. Run `npm run copy-deps`
4. Test thoroughly

## DevExpress

DevExpress libraries are not managed through npm due to licensing requirements. These libraries should be updated manually by downloading from the official DevExpress website.

## Notes

- The `node_modules` directory and `package-lock.json` are excluded from version control
- Old jQuery versions (1.12.3, 2.2.3, 3.1.0) are kept for backwards compatibility if needed
- The plugin currently uses the old monolithic vis.js v4.21.0 library for compatibility
- Modern vis-network and vis-timeline libraries are available but require code migration
- Always test after updating dependencies

## Future Migration

The code currently uses the old vis.js v4.21.0 library. To migrate to the modern vis-network library:

1. Update `lib/api_neighbor.php` to load vis-network instead of vis.js
2. Update `js/map.js` to use the vis-network API (mostly compatible but with some changes)
3. Test thoroughly as the API has some differences
