# pr0game sync script

This script was developed for the pr0game.com browser game. It allows to extract specific game information, such as statistics and spy reports, from the game and upload it to a remote database.

The databse used by this script is a PockbetBase instance, though it should be possible to adapt it to any other backend by changing the login and upload calls.

For use, simply add this script to Tampermonkey or the likes and edit the database URL, if your databse is not running on localhost. The script is currently only active for universe 5, but you may choose to edit the @include directives to activate it for any other universe.

When not running the backend on localhost, you also need to change the @require directive to point to your public `pocketbase.umd.js` copy, when using Pocketbase.

# Functions

Currently, the scripts supports the following actions:

- Upload statistic pages
- Upload spy reports
- Upload player card information (currently broken)
- Upload galaxy view

For each action, a green icon is inserted into the page where appropriate. When the icon is clicked, the information is parsed from the current page and uploaded as JSON data to the remote server.

# Backend

The backend must expose the following routes

- /galaxy (for the galaxy state)
- /spio (for spy reports)
- /stats (for statistics updates)
- /player (for player card update)

Once the JSON data is received, you can save and handle it in any way it suites your needs.

# Login

For use with the PocketBase backend, the script will add a login form on the ingame settings page. If you choose another backend, you may want to change the handling of this form or remove it entirely.
