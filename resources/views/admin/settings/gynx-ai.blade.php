@extends('layouts.admin')
@include('partials/admin.settings.nav', ['activeTab' => 'gynx-ai'])

@section('title')
    gynx.ai Settings
@endsection

@section('content-header')
    <h1>gynx.ai<small>Configure the in-panel diagnostic assistant.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li><a href="{{ route('admin.settings') }}">Settings</a></li>
        <li class="active">gynx.ai</li>
    </ol>
@endsection

@section('content')
    @yield('settings::nav')
    <div class="row">
        <div class="col-xs-12">
            <div class="box">
                <div class="box-header with-border">
                    <h3 class="box-title">Provider</h3>
                </div>
                <form>
                    <div class="box-body">
                        <div class="row">
                            <div class="form-group col-md-4">
                                <label class="control-label">Enabled</label>
                                <div>
                                    <select name="services:gynx_ai:enabled" class="form-control">
                                        <option value="true" @if($enabled) selected @endif>On — gynx.ai is available to users</option>
                                        <option value="false" @if(!$enabled) selected @endif>Off — card hidden in the panel</option>
                                    </select>
                                    <p class="text-muted small">Master switch. The card on the server console renders a "coming soon" placeholder when this is off.</p>
                                </div>
                            </div>
                            <div class="form-group col-md-4">
                                <label class="control-label">Provider</label>
                                <div>
                                    <select name="services:gynx_ai:provider" class="form-control">
                                        <option value="gemini" @if($provider === 'gemini') selected @endif>Google Gemini</option>
                                    </select>
                                    <p class="text-muted small">v1 ships with Gemini only. Claude / OpenAI bindings are wired through the same interface for a future release.</p>
                                </div>
                            </div>
                            <div class="form-group col-md-4">
                                <label class="control-label">Daily cap (per server)</label>
                                <div>
                                    <input type="number" min="0" max="1000" class="form-control" name="services:gynx_ai:daily_cap_per_server" value="{{ old('services:gynx_ai:daily_cap_per_server', $dailyCap) }}" />
                                    <p class="text-muted small">Per-server cap on calls per UTC day. 0 disables AI for users while keeping the feature flag on.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col-xs-12">
            <div class="box">
                <div class="box-header with-border">
                    <h3 class="box-title">Gemini credentials</h3>
                </div>
                <form>
                    <div class="box-body">
                        <div class="row">
                            <div class="form-group col-md-8">
                                <label class="control-label">API key</label>
                                <div>
                                    <input type="password" autocomplete="off" class="form-control" name="services:gynx_ai:gemini:api_key" placeholder="@if($apiKeyConfigured){{ $apiKeyMasked }}@else paste a key from aistudio.google.com/app/apikey @endif" />
                                    <p class="text-muted small">
                                        @if($apiKeyConfigured)
                                            A key is configured. Leave blank to keep it; type a new key to replace; type <code>!clear</code> to remove it.
                                        @else
                                            Generate one at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">aistudio.google.com/app/apikey</a>. Stored encrypted at rest.
                                        @endif
                                    </p>
                                </div>
                            </div>
                            <div class="form-group col-md-4">
                                <label class="control-label">Model</label>
                                <div>
                                    <input type="text" class="form-control" name="services:gynx_ai:gemini:model" value="{{ old('services:gynx_ai:gemini:model', $model) }}" />
                                    <p class="text-muted small">Default <code>gemini-2.0-flash</code>. Switch to <code>gemini-2.5-flash</code> or <code>gemini-2.5-pro</code> for better reasoning at higher cost.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="box-footer">
                        {{ csrf_field() }}
                        <div class="pull-right">
                            <button type="button" id="testButton" class="btn btn-sm btn-success">Test connection</button>
                            <button type="button" id="saveButton" class="btn btn-sm btn-primary">Save</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    </div>
@endsection

@section('footer-scripts')
    @parent

    <script>
        function collect() {
            return {
                'services:gynx_ai:enabled': $('select[name="services:gynx_ai:enabled"]').val(),
                'services:gynx_ai:provider': $('select[name="services:gynx_ai:provider"]').val(),
                'services:gynx_ai:gemini:api_key': $('input[name="services:gynx_ai:gemini:api_key"]').val(),
                'services:gynx_ai:gemini:model': $('input[name="services:gynx_ai:gemini:model"]').val(),
                'services:gynx_ai:daily_cap_per_server': $('input[name="services:gynx_ai:daily_cap_per_server"]').val(),
            };
        }

        function saveSettings() {
            return $.ajax({
                method: 'PATCH',
                url: '/admin/settings/gynx-ai',
                contentType: 'application/json',
                data: JSON.stringify(collect()),
                headers: { 'X-CSRF-Token': $('input[name="_token"]').val() }
            }).fail(function (jqXHR) { showErrorDialog(jqXHR, 'save'); });
        }

        function testSettings() {
            $.ajax({
                method: 'POST',
                url: '/admin/settings/gynx-ai/test',
                headers: { 'X-CSRF-TOKEN': $('input[name="_token"]').val() }
            }).fail(function (jqXHR) {
                showErrorDialog(jqXHR, 'test');
            }).done(function () {
                swal({
                    title: 'Success',
                    text: 'Gemini responded. Your key works.',
                    type: 'success'
                });
            });
        }

        function showErrorDialog(jqXHR, verb) {
            console.error(jqXHR);
            var errorText = '';
            if (!jqXHR.responseJSON) {
                errorText = jqXHR.responseText;
            } else if (jqXHR.responseJSON.error) {
                errorText = jqXHR.responseJSON.error;
            } else if (jqXHR.responseJSON.errors) {
                $.each(jqXHR.responseJSON.errors, function (i, v) {
                    if (v.detail) errorText += v.detail + ' ';
                });
            }
            swal({
                title: 'Whoops!',
                text: 'An error occurred while attempting to ' + verb + ' gynx.ai settings: ' + errorText,
                type: 'error'
            });
        }

        $(document).ready(function () {
            $('#testButton').on('click', function () {
                saveSettings().done(testSettings);
            });
            $('#saveButton').on('click', function () {
                saveSettings().done(function () {
                    swal({
                        title: 'Saved',
                        text: 'gynx.ai settings have been updated.',
                        type: 'success'
                    });
                });
            });
        });
    </script>
@endsection
