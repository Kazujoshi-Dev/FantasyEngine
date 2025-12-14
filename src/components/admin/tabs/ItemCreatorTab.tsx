
import React, { useState, useMemo, useEffect } from 'react';
import { ItemTemplate, Affix, AdminCharacterInfo, ItemCategory, AffixType, ItemInstance } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { api } from '../../../api';
import { ItemDetailsPanel } from '../../shared/ItemSlot';

interface ItemCreatorTabProps {
    itemTemplates: ItemTemplate[];
    