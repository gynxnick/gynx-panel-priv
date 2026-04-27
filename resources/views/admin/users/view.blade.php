@extends('layouts.gynx-admin')

@section('title', "Manage user: {$user->username}")
@section('header-title', "{$user->name_first} {$user->name_last}")
@section('header-sub', $user->username)

@section('content')
    <form action="{{ route('admin.users.view', $user->id) }}" method="post">
        {{ csrf_field() }}
        {{ method_field('PATCH') }}
        <div class="grid grid--cols-2">
            <div class="card">
                <div class="card__header">
                    <h3 class="card__title">Identity</h3>
                </div>
                <div class="card__body">
                    <div class="field">
                        <label class="field__label" for="u-email">Email</label>
                        <input id="u-email" type="email" name="email"
                               value="{{ $user->email }}" class="field__input form-autocomplete-stop">
                    </div>
                    <div class="field">
                        <label class="field__label" for="u-username">Username</label>
                        <input id="u-username" type="text" name="username"
                               value="{{ $user->username }}" class="field__input form-autocomplete-stop">
                    </div>
                    <div class="field">
                        <label class="field__label" for="u-first">Client first name</label>
                        <input id="u-first" type="text" name="name_first"
                               value="{{ $user->name_first }}" class="field__input form-autocomplete-stop">
                    </div>
                    <div class="field">
                        <label class="field__label" for="u-last">Client last name</label>
                        <input id="u-last" type="text" name="name_last"
                               value="{{ $user->name_last }}" class="field__input form-autocomplete-stop">
                    </div>
                    <div class="field">
                        <label class="field__label" for="u-lang">Default language</label>
                        <select id="u-lang" name="language" class="field__select">
                            @foreach($languages as $key => $value)
                                <option value="{{ $key }}" @if($user->language === $key) selected @endif>{{ $value }}</option>
                            @endforeach
                        </select>
                        <span class="field__hint">The default language to use when rendering the panel for this user.</span>
                    </div>
                </div>
                <div class="card__footer">
                    <button type="submit" class="btn btn--primary">Update user</button>
                </div>
            </div>

            <div>
                <div class="card">
                    <div class="card__header">
                        <h3 class="card__title">Permissions</h3>
                    </div>
                    <div class="card__body">
                        <div class="field" style="margin-bottom: 0;">
                            <label class="field__label" for="u-admin">Administrator</label>
                            <select id="u-admin" name="root_admin" class="field__select">
                                <option value="0">@lang('strings.no')</option>
                                <option value="1" {{ $user->root_admin ? 'selected="selected"' : '' }}>@lang('strings.yes')</option>
                            </select>
                            <span class="field__hint">Setting this to <strong>yes</strong> gives a user full administrative access.</span>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card__header">
                        <h3 class="card__title">Password</h3>
                    </div>
                    <div class="card__body">
                        <div id="gen_pass" class="alert alert--success" style="display:none;"></div>
                        <div class="field" style="margin-bottom: 0;">
                            <label class="field__label" for="u-pass">Password <span style="color: var(--text-mute); font-weight: 400;">(optional)</span></label>
                            <input id="u-pass" type="password" name="password" class="field__input form-autocomplete-stop">
                            <span class="field__hint">Leave blank to keep the current password. The user is not notified if changed here.</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </form>

    <div class="card card--danger">
        <div class="card__header">
            <h3 class="card__title">Delete user</h3>
        </div>
        <div class="card__body">
            <p class="card__intro" style="margin-bottom: 0;">
                There must be no servers associated with this account in order for it to be deleted.
            </p>
        </div>
        <div class="card__footer">
            <form action="{{ route('admin.users.view', $user->id) }}" method="POST" style="margin-left: auto;">
                {{ csrf_field() }}
                {{ method_field('DELETE') }}
                <button id="delete" type="submit" class="btn btn--danger"
                        {{ $user->servers->count() < 1 ? '' : 'disabled' }}>
                    Delete user
                </button>
            </form>
        </div>
    </div>
@endsection
