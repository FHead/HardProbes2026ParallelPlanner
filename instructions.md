

Good day, I am trying to construct a web tool to drag and drop different contributions to make the program.

In this folder there is the csv files with contributions.  Each row is one contribution.

There are two types of contributions: poster and oral.  We will not deal with posters here.  Please also filter out the ones that are not accepted.

For oral contributions, there are different tracks.  Here we will focus on the jet track and the High-momentum hadrons track.

In the web tool, I want the following functionality.

1. there will be a big grid with multiple columns spanning the width of the web page, and each row can have one contribution box in it, or leave blank.  In the top we have column title "Not decided", "Jet", "Substructure", "HighPT", "EEC", "Small System"
1. there will be a small draggable box with ID & title in it, for each contribution.  Jet will have one color, high momentum ones another color.  The box can be dragged to different location in the grid.  Please have a small indicator in the upper-right corner of each box whether it's an experimental talk or a theory talk.
1. In the beginning, all boxes will be in the first column.
1. Please have an export and import functionality saving (ID, grid-column, grid-row) for all boxes.  Please save also the grid column index.  When importing, if column index is present, use that.  Otherwise fall back to column name matching.

Please make a first minimal viable option without needing a web server and we will iterate further.  Please make a folder called "web" and put everything webpage related in there.

You can make a filtered json with only the needed information so that the client-side code can be leaner.

Please keep a verbatim record of our conversation so we have a record in conversation_log.md and append the visible user/assistant messages there going forward

Please infer CSV columns from the files in this folder and adapt the loader accordingly


