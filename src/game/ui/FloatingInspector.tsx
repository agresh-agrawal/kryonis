'use client';

import { useEffect, useState } from 'react';

import {
  BUILDINGS,
  MAX_UPGRADE_LEVEL,
  UPGRADE_TIERS,
  upgradeCost,
  upgradeTier,
} from '../buildings/catalog';
import { RESOURCES, canAfford, formatAmount, type ResourceId } from '../core/resources';
import { constructionProgress, useColonyStore } from '../state/useColonyStore';
import { BUILDING_ICONS } from './buildingIcons';
import { UpgradeIcon } from './icons';
import { useTicker } from './useTicker';

/**
 * The selected-structure inspector.
 *
 * A small floating card rather than a docked panel. It carries the render, one
 * ring, three numbers and four actions - and nothing else. The long description
 * and the full production table that used to live here were removed: they were
 * read once per building type and then never again, which makes them
 * documentation, not interface.
 *
 * The ring shows condition at a glance. During construction or a retrofit it
 * fills with progress instead, so the same element answers "is it ready?" and
 * "is it healthy?" without ever showing two rings.
 */
export function FloatingInspector() {
  useTicker(5);

  const selectedId = useColonyStore((state) => state.selectedId);
  const buildings = useColonyStore((state) => state.buildings);
  const stock = useColonyStore((state) => state.stock);
  const select = useColonyStore((state) => state.select);
  const demolish = useColonyStore((state) => state.demolish);
  const upgrade = useColonyStore((state) => state.upgrade);

  const building = buildings.find((entry) => entry.id === selectedId);
  if (!building) return null;

  const def = BUILDINGS[building.type];
  const Icon = BUILDING_ICONS[building.type];
  const tier = upgradeTier(building.level);
  const building_ = building;

  const underWork = building_.progress < 1;
  const progress = underWork ? (constructionProgress.get(building_.id) ?? 0) : 1;

  const atMax = building_.level >= MAX_UPGRADE_LEVEL;
  const nextTier = atMax ? null : UPGRADE_TIERS[building_.level];
  const cost = atMax ? {} : upgradeCost(building_.type, building_.level);
  const canUpgrade = !atMax && !underWork && canAfford(stock, cost);

  // Ring shows build/retrofit progress while working, condition otherwise.
  const ringValue = underWork ? progress : 1;
  const ringColor = underWork ? 'var(--color-warn)' : 'var(--color-good)';
  const circumference = 2 * Math.PI * 22;

  return (
    <div className="glass anim-rise pointer-events-auto w-[17.5rem] overflow-hidden rounded-[3px]">
      {/* Header: render, name, ring. */}
      <div className="flex items-center gap-3 p-3">
        <span className="relative grid h-14 w-14 shrink-0 place-items-center">
          <svg viewBox="0 0 52 52" className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="26" cy="26" r="22" fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="2" />
            <circle
              cx="26"
              cy="26"
              r="22"
              fill="none"
              stroke={ringColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${circumference * ringValue} ${circumference}`}
              className="transition-[stroke-dasharray] duration-500"
            />
          </svg>
          <Icon className="h-8 w-8 text-steel" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="t-micro block">{def.category}</span>
          <span className="t-md mt-1 block truncate text-bone">{def.name}</span>
          <span className="t-micro mt-1 block tracking-[0.1em] text-titanium">
            {underWork
              ? building_.level > 1
                ? `Retrofitting · ${Math.round(progress * 100)}%`
                : `Building · ${Math.round(progress * 100)}%`
              : tier.name}
          </span>
        </span>

        <button
          type="button"
          onClick={() => select(null)}
          aria-label="Close"
          className="press grid h-6 w-6 shrink-0 place-items-center rounded-[2px] text-titanium hover:text-bone"
        >
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-current" aria-hidden>
            <path d="M2.4 1.3L6 4.9l3.6-3.6 1.1 1.1L7.1 6l3.6 3.6-1.1 1.1L6 7.1l-3.6 3.6-1.1-1.1L4.9 6 1.3 2.4z" />
          </svg>
        </button>
      </div>

      <span className="rule-x" />

      {/* Three figures that actually change with the tier. */}
      <div className="grid grid-cols-3 gap-px bg-white/[0.05]">
        <Figure
          label="Power"
          value={`${def.power > 0 ? '+' : ''}${Math.round(
            def.power > 0 ? def.power * tier.output : def.power * tier.power,
          )}`}
          tone={def.power > 0 ? 'good' : 'normal'}
        />
        <Figure label="Crew" value={def.workers > 0 ? String(def.workers) : '—'} />
        <Figure
          label="Output"
          value={
            Object.keys(def.output).length > 0
              ? `${((Object.values(def.output)[0] as number) * tier.output).toFixed(2)}`
              : '—'
          }
          tone={Object.keys(def.output).length > 0 ? 'good' : 'normal'}
        />
      </div>

      <span className="rule-x" />

      {/* Upgrade: tier pips and a single line of consequence. */}
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="t-micro">Tier</span>
          <span className="flex gap-1">
            {UPGRADE_TIERS.map((entry) => (
              <span
                key={entry.level}
                title={entry.name}
                className={`h-[3px] w-6 rounded-full transition-colors duration-300 ${
                  building_.level >= entry.level ? 'bg-dust' : 'bg-white/10'
                }`}
              />
            ))}
          </span>
        </div>

        {nextTier ? (
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="t-sm text-ash">
              {nextTier.name}
              <span className="text-faint"> · +{Math.round((nextTier.output - tier.output) * 100)}% output</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              {(Object.entries(cost) as [ResourceId, number][]).slice(0, 2).map(([resource, amount]) => (
                <span
                  key={resource}
                  className={`t-num text-[0.62rem] ${
                    stock[resource] < amount ? 'text-alert' : 'text-faint'
                  }`}
                  title={RESOURCES[resource].label}
                >
                  {formatAmount(amount)}
                </span>
              ))}
            </span>
          </div>
        ) : (
          <p className="t-sm mt-2 text-faint">Fully optimised.</p>
        )}
      </div>

      <span className="rule-x" />

      {/* Actions: icons, evenly weighted, destructive one held apart. */}
      <div className="flex items-stretch">
        <Action
          label={nextTier ? `Retrofit to ${nextTier.name}` : 'Fully optimised'}
          disabled={!canUpgrade}
          primary
          onClick={() => upgrade(building_.id)}
        >
          <UpgradeIcon className="h-3.5 w-3.5" />
          <span className="t-sm">Upgrade</span>
        </Action>

        <span className="rule-y" />

        <Action
          label="Demolish this structure"
          disabled={building_.type === 'lander'}
          destructive
          onClick={() => demolish(building_.id)}
        >
          <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 fill-current" aria-hidden>
            <path d="M5 2h4l.5 1H12v1.5H2V3h2.5zM3.2 6h7.6l-.6 7H3.8z" />
          </svg>
        </Action>
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  tone = 'normal',
}: {
  label: string;
  value: string;
  tone?: 'normal' | 'good';
}) {
  return (
    <div className="bg-graphite/60 px-3 py-2.5">
      <span className="t-micro block">{label}</span>
      <span className={`t-num mt-1.5 block text-[0.88rem] ${tone === 'good' ? 'text-good' : 'text-bone'}`}>
        {value}
      </span>
    </div>
  );
}

function Action({
  label,
  disabled,
  primary,
  destructive,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  primary?: boolean;
  destructive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex items-center justify-center gap-2 py-2.5 transition-colors ${
        primary ? 'flex-1' : 'w-12'
      } ${
        disabled
          ? 'cursor-not-allowed text-faint/40'
          : destructive
            ? 'text-titanium hover:bg-alert/12 hover:text-alert'
            : 'text-dust hover:bg-white/[0.06]'
      }`}
    >
      {children}
    </button>
  );
}
