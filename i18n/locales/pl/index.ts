
import common from './common';
import auth from './auth';
import character from './character';
import ui from './ui';
import world from './world';
import combat from './combat';
import items from './items';
import entities from './entities';
import guild from './guild';
import admin from './admin';

const plLocale = {
    ...common,
    ...auth,
    ...character,
    ...ui,
    ...world,
    ...combat,
    ...items,
    ...entities,
    ...guild,
    ...admin,
};

export default plLocale;
