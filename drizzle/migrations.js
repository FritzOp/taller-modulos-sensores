// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_absent_blindfold.sql';
import m0001 from './0001_absent_patch.sql';
import m0002 from './0002_steep_slyde.sql';
import m0003 from './0003_sync_bidireccional.sql';
import m0004 from './0004_quitar_columnas_antiguas.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004
    }
  }
  