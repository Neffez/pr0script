/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/stats", (c) => {
    if(!c.get("authRecord") && !c.get('admin'))
        return c.json(403, { "message": "Nicht angemeldet"});
    const info = $apis.requestInfo(c);
    const auth_id = info.authRecord.getId();
    // Check permissions
    try{
        const permissions = $app.dao().findFirstRecordByData("permissions", "user", auth_id);
        if(!permissions.get('stats_update'))
        return c.json(403, { "message": "Kein Zugriff!"});
    } catch {
        return c.json(403, { "message": "Kein Zugriff!"});
    }


    const data = new DynamicModel({
        // describe the fields to read (used also as initial values)
        "epoch": 0,
        "ranking_type": 0,
        "rankings": [],
    });
    c.bind(data)

    var stat_type = ''; 
    if(data.ranking_type == 1)  stat_type = 'points';
    else if(data.ranking_type == 2)  stat_type = 'fleet';
    else if(data.ranking_type == 3)  stat_type = 'research';
    else if(data.ranking_type == 4)  stat_type = 'buildings';
    else if(data.ranking_type == 5)  stat_type = 'defense';
    else {
        return c.json(403, { "message": "Unbekannte Statistik!"});
    }

    // There appears to be a big with timezone comparisons in $dbs.between calls, so we 
    // add a 3hour buffer
    var cold_timestamp = new Date(data.epoch - 3 * 3600 * 1000);
    var hot_timestamp = new Date(data.epoch + 3 * 3600 * 1000);
    var timestamp = new Date(data.epoch);

    console.log("Ranking report", stat_type, data.rankings[0]['rank'], timestamp);

    const players = $app.dao().findCollectionByNameOrId("players");
    const allis = $app.dao().findCollectionByNameOrId("alliances");
    const uni_rankings = $app.dao().findCollectionByNameOrId("uni_rankings");

    for(var i = 0; i < data.rankings.length; i++)
    {
        const new_ranking = data.rankings[i];
        const last_records = $app.dao().findRecordsByExpr('uni_rankings', 
            $dbx.hashExp({player_id: new_ranking["player_id"]}),
            $dbx.between('date', cold_timestamp, hot_timestamp),
        );
        if(last_records.length != 0)
        {
            const last_record = last_records[0];
            if(last_record.get("rank_"+stat_type) == 0)
            {
                // Update record
                last_record.set("rank_"+stat_type, new_ranking["rank"]);
                last_record.set("points_"+stat_type, new_ranking["points"]);
                last_record.set("update_by", auth_id);
                $app.dao().saveRecord(last_record);
            }
        }
        else
        {
            var record_data = {
                date: timestamp,
                player_id: new_ranking["player_id"],
                alli_id: new_ranking["alli_id"],
                rank_points: 0,
                points_points: -1,
                rank_buildings: 0,
                points_buildings: -1,
                rank_defense: 0,
                points_defense: -1,
                rank_fleet: 0,
                points_fleet: -1,
                rank_research: 0,
                points_research: -1,
                update_by: auth_id,
                umode: new_ranking['is_umode'],
                inactive: new_ranking['is_inactive'],
                inactive_long: new_ranking['is_inactive_long'],
                banned: new_ranking['is_banned']
            }
            record_data["rank_"+stat_type] = new_ranking["rank"];
            record_data["points_"+stat_type] = new_ranking["points"];
            try {
                const record = new Record(uni_rankings);
                const form = new RecordUpsertForm($app, record)
                form.loadData(record_data);
                form.submit();
            } catch(e)
            {
                console.log("Failed to insert: ", e);
                break;
            }

        }

        // UpSert players into database
        try{
            const player = $app.dao().findFirstRecordByData("players", "player_id", new_ranking['player_id']);
            if(
                player.get('alli_id') != new_ranking['alli_id'] ||
                player.get('player_name') != new_ranking['player_name'])
            {
                player.set('alli_id', new_ranking['alli_id'])
                player.set('player_name', new_ranking['player_name'])
                $app.dao().saveRecord(player);
            }
        } catch(e)
        {
            try{
                // Player does not exist
                const record = new Record(players);
                const form = new RecordUpsertForm($app, record)
                form.loadData({
                    player_id: new_ranking['player_id'],
                    player_name: new_ranking['player_name'],
                    alli_id: new_ranking['alli_id'],
                });
                form.submit();
            } catch(e)
            {
                console.log("Failed to insert: ", e);
                break;
            }
        }
        // UpSert alliances into database
        if(new_ranking['alli_id'] != 0)
        {
            try{
                const alli = $app.dao().findFirstRecordByData("alliances", "alli_id", new_ranking['alli_id']);
                if(
                    alli.get('alli_name') != new_ranking['alli_name'])
                {
                    alli.set('alli_name', new_ranking['alli_name'])
                    $app.dao().saveRecord(alli);
                }
            } catch(e)
            {
                try{
                    // Alli does not exist
                    const record = new Record(allis);
                    const form = new RecordUpsertForm($app, record)
                    form.loadData({
                        alli_id: new_ranking['alli_id'],
                        alli_name: new_ranking['alli_name'],
                    });
                    form.submit();
                } catch(e)
                {
                    console.log("Failed to insert: ", e);
                    break;
                }
            }
        }
    }
    return c.json(200, { "message": "ok"});
});