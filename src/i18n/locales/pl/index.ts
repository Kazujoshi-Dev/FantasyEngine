
import common from './common';
import auth from './auth';
import ui from './ui';
import gameplay from './gameplay';
import items from './items';
import world from './world';
import guild from './guild';
import admin from './admin';

const pl = {
    ...common,
    ...auth,
    ...ui,
    ...gameplay,
    ...items,
    ...world,
    ...guild,
    ...admin
};

export default pl;
