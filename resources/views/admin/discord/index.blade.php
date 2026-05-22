@extends('layouts.gynx-admin')

@section('title', 'Discord')
@section('header-title', 'Discord')
@section('header-sub', 'Editable Discord copy and (later) webhook integration.')

@section('content')
    <div class="alert alert--info">
        <strong>Heads up — saved edits are live, but two things require a rebuild.</strong>
        <ul>
            <li>
                Saved values become live for new page loads as soon as you hit <em>Save Discord text</em>. Logged-in users
                may need a hard refresh (<kbd>Ctrl+Shift+R</kbd>) to clear the bundled <code>SiteConfiguration</code>.
            </li>
            <li>
                If you change a <strong>default</strong> value (i.e. you edit the source code, not the form), or add a
                new field, the panel must be rebuilt: <code>yarn build:production</code> on the server.
            </li>
        </ul>
    </div>

    <div class="card">
        <div class="card__header">
            <h3 class="card__title">Discord copy</h3>
            <form action="{{ route('admin.discord.reset') }}" method="POST" style="display:inline"
                  onsubmit="return confirm('Restore every field to its default?')">
                {{ csrf_field() }}
                <button type="submit" class="btn btn--ghost btn--sm">Reset all to defaults</button>
            </form>
        </div>
        <div class="card__body">
            <p class="card__intro">
                These values are served from the <code>settings::gynx:discord:*</code> namespace and rendered by the
                React bundle (where applicable). The webhook URL is stored server-side only and never shipped to the
                browser. Leave a non-toggle field blank to restore its default.
            </p>

            <form action="{{ route('admin.discord.update') }}" method="POST">
                {{ csrf_field() }}

                @foreach($fields as $key => $meta)
                    <div class="field">
                        <label class="field__label" for="f-{{ $key }}">{{ $meta['label'] }}</label>

                        @if($meta['type'] === 'bool')
                            <label class="field__checkbox-row">
                                <input id="f-{{ $key }}" type="checkbox" name="{{ $key }}" value="1"
                                    @if($values[$key] === '1') checked @endif>
                                <span>Enabled</span>
                            </label>
                        @elseif($meta['type'] === 'textarea')
                            <textarea id="f-{{ $key }}" name="{{ $key }}" class="field__textarea"
                                rows="4"
                                maxlength="{{ $meta['max'] }}"
                                placeholder="{{ $meta['default'] }}">{{ $values[$key] }}</textarea>
                        @elseif($meta['type'] === 'url')
                            <input id="f-{{ $key }}" type="url" name="{{ $key }}" class="field__input"
                                maxlength="{{ $meta['max'] }}"
                                placeholder="{{ $meta['default'] ?: 'https://example.com' }}" value="{{ $values[$key] }}">
                            @if($key === 'webhook_url' && $values[$key])
                                <span class="field__hint">A webhook is configured. The URL is masked here — submit a blank value to remove it.</span>
                            @endif
                        @else
                            <input id="f-{{ $key }}" type="text" name="{{ $key }}" class="field__input"
                                maxlength="{{ $meta['max'] }}"
                                placeholder="{{ $meta['default'] }}" value="{{ $values[$key] }}">
                        @endif

                        @if($meta['type'] !== 'bool' && $key !== 'webhook_url')
                            <span class="field__hint"><em>Default:</em> {{ $meta['default'] ?: '(empty)' }}</span>
                        @endif
                    </div>
                @endforeach

                <button type="submit" class="btn btn--primary">Save Discord text</button>
            </form>
        </div>
    </div>
@endsection
