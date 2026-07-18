# CryptoWatch — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot for private cryptocurrency price tracking with customizable alerts, quiet hours, and owner analytics. Users manage watchlists, set price thresholds/percent-move alerts, receive on-demand prices, and optional daily summaries while maintaining data privacy.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- individual crypto traders
- crypto hobbyists
- Telegram power users

## Success criteria

- users receive accurate price alerts within 1 minute of threshold crossing
- daily summaries delivered at user-specified local time
- owner dashboard shows real-time alert statistics

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with quick actions and watchlist management
- **/price** (command, actor: user, command: /price) — Check current price of specified coin or full watchlist
  - inputs: ticker symbol (optional)
  - outputs: current price with % change
- **Add Coin** (button, actor: user, callback: watchlist:add) — Add new cryptocurrency to watchlist via button or typed ticker
- **Manage Alerts** (button, actor: user, callback: alerts:manage) — Configure threshold/percent-move alerts for watchlist items
- **/owner** (command, actor: owner, command: /owner) — Display aggregated usage metrics and alert statistics

## Flows

### alert_trigger
_Trigger:_ price_cross_threshold

1. check user's active alerts
2. validate against current price
3. send alert if rules match and not in cooldown

_Data touched:_ User, Watchlist Item

### daily_summary
_Trigger:_ morning_summary_time

1. check user's enabled summary time
2. compile prices and % changes for all watchlist coins
3. send formatted summary message

_Data touched:_ User

### error_retry
_Trigger:_ price_lookup_failure

1. log failure
2. retry lookup up to 3 times
3. suppress alert if all retries fail

_Data touched:_ Watchlist Item

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **User** _(retention: persistent)_ — Telegram user with preferences and watchlist
  - fields: telegram_chat_id, timezone, quiet_hours_start, quiet_hours_end, summary_time, watchlist, alert_cooldowns
- **Watchlist Item** _(retention: persistent)_ — Tracked cryptocurrency with alert rules
  - fields: ticker, display_name, threshold_alerts, percent_move_alerts, last_notified_price, last_notified_time
- **Owner Metrics** _(retention: persistent)_ — Aggregated usage statistics
  - fields: total_users, alert_fire_counts, recent_alert_timestamps

## Integrations

- **Telegram** (required) — Bot API messaging and user interactions
- **Price Feed** (required) — Market price data source
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- view /owner dashboard with user count and alert statistics
- configure default cooldown durations
- modify popular coin buttons in main menu

## Notifications

- price threshold alerts
- percent-change alerts
- daily summary messages
- error notifications for manual price checks

## Permissions & privacy

- all user data is private and never shared
- owner-only /owner command requires authentication
- quiet hours prevent alerts during specified times

## Edge cases

- unknown ticker symbol input
- price feed API outages
- conflicting alert rules
- time zone conversion errors

## Required tests

- alert suppression during quiet hours
- daily summary delivery at user's local time
- owner dashboard shows accurate metrics

## Assumptions

- single canonical market selected per ticker
- 1-hour default for percent-move windows
- 1-hour default cooldown after alerts
